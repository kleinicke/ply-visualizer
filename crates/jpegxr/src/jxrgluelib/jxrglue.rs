// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

use crate::common::include::guiddef::{is_equal_guid, GUID};
use crate::image::sys::strcodec::{create_ws_file_owned, CWMImageStrCodec, WsFileMode};
use crate::image::sys::windowsmediaphoto::{
    tagCWMImageInfo, tagCWMTranscodingParam, BitstreamFormat, Orientation, Subband, WMPStream,
};
use crate::jxrgluelib::jxrglue_jxr::{
    pk_image_decode_create_wmp_owned, pk_image_encode_create_wmp_owned,
};
use crate::jxrgluelib::jxrglue_pfc::{
    pk_format_converter_convert, pk_format_converter_copy, pk_format_converter_get_pixel_format,
    pk_format_converter_get_resolution, pk_format_converter_get_size,
    pk_format_converter_get_source_pixel_format, pk_format_converter_initialize,
    pk_format_converter_initialize_convert,
};
use crate::jxrgluelib::jxrmeta::{tagWmpDEMisc, DESCRIPTIVEMETADATA};
use std::ffi::OsStr;
use std::ops::{BitAnd, BitOr};
use std::path::Path;
use std::ptr::NonNull;

#[repr(u32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PkIid {
    ImageScanEncode = 1,
    ImageFrameEncode = 2,
    ImageUnsupported = 100,
    ImageWmpEncode = 101,
    ImageWmpDecode = 201,
}

#[repr(i32)]
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum BandedEncodeState {
    #[default]
    Uninitialized = 0,
    Init = 1,
    Encoding = 2,
    Terminated = 3,
    NonBandedEncode = 4,
}
pub use crate::common::include::guiddef::GUID as PKPixelFormatGUID;
#[repr(transparent)]
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct PixelFormatFlags(pub u64);

impl PixelFormatFlags {
    pub const NONE: Self = Self(0x00000000);
    pub const HAS_ALPHA: Self = Self(0x00000010);
    pub const PRE_MULTIPLIED: Self = Self(0x00000020);
    pub const BGR: Self = Self(0x00000040);
    pub const HAS_ALPHA_BGR: Self = Self(Self::HAS_ALPHA.0 | Self::BGR.0);
    pub const HAS_ALPHA_PRE_MULTIPLIED: Self = Self(Self::HAS_ALPHA.0 | Self::PRE_MULTIPLIED.0);
    pub const HAS_ALPHA_PRE_MULTIPLIED_BGR: Self =
        Self(Self::HAS_ALPHA.0 | Self::PRE_MULTIPLIED.0 | Self::BGR.0);
}

impl BitOr for PixelFormatFlags {
    type Output = Self;

    fn bitor(self, rhs: Self) -> Self::Output {
        Self(self.0 | rhs.0)
    }
}

impl BitAnd for PixelFormatFlags {
    type Output = Self;

    fn bitand(self, rhs: Self) -> Self::Output {
        Self(self.0 & rhs.0)
    }
}

#[repr(i32)]
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, PartialOrd, Ord)]
pub enum ColorFormat {
    #[default]
    YOnly = 0,
    Yuv420 = 1,
    Yuv422 = 2,
    Yuv444 = 3,
    Cmyk = 4,
    NComponent = 6,
    Rgb = 7,
    Rgbe = 8,
    Max = 9,
}
#[repr(i32)]
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, PartialOrd, Ord)]
pub enum BitDepth {
    One = 0,
    #[default]
    Eight = 1,
    Sixteen = 2,
    SixteenS = 3,
    SixteenF = 4,
    ThirtyTwo = 5,
    ThirtyTwoS = 6,
    ThirtyTwoF = 7,
    Five = 8,
    Ten = 9,
    FiveSixFive = 10,
    OneAlt = 0xf,
}
#[repr(u32)]
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum PixelFormatInterpretation {
    #[default]
    WhiteIsZero = 0,
    BlackIsZero = 1,
    Rgb = 2,
    Cmyk = 5,
    NChannel = 100,
    Rgbe = 101,
}
pub type PKFormatConverterInitializeFn = unsafe fn(
    &mut tagPKFormatConverter,
    *mut tagPKImageDecode,
    *const u8,
    PKPixelFormatGUID,
) -> Result<(), crate::WmpError>;
pub type PKFormatConverterInitializeConvertFn = unsafe fn(
    &mut tagPKFormatConverter,
    PKPixelFormatGUID,
    *const u8,
    PKPixelFormatGUID,
) -> Result<(), crate::WmpError>;
pub type PKFormatConverterGetPixelFormatFn = unsafe fn(
    &mut tagPKFormatConverter,
    Option<&mut PKPixelFormatGUID>,
) -> Result<(), crate::WmpError>;
pub type PKFormatConverterGetSizeFn = unsafe fn(
    &mut tagPKFormatConverter,
    Option<&mut i32>,
    Option<&mut i32>,
) -> Result<(), crate::WmpError>;
pub type PKFormatConverterGetResolutionFn = unsafe fn(
    &mut tagPKFormatConverter,
    Option<&mut f32>,
    Option<&mut f32>,
) -> Result<(), crate::WmpError>;
pub type PKFormatConverterCopyFn = unsafe fn(
    &mut tagPKFormatConverter,
    Option<&tagPKRect>,
    &mut [u8],
    u32,
) -> Result<(), crate::WmpError>;
pub type PKPixelConverterFn = unsafe fn(
    &mut tagPKFormatConverter,
    *const tagPKRect,
    *mut u8,
    u32,
) -> Result<(), crate::WmpError>;
pub type PKImageDecodeGetPixelFormatFn =
    unsafe fn(&mut tagPKImageDecode, Option<&mut PKPixelFormatGUID>) -> Result<(), crate::WmpError>;
pub type PKImageDecodeInitializeFn =
    unsafe fn(&mut tagPKImageDecode, &mut WMPStream) -> Result<(), crate::WmpError>;
pub type PKImageDecodeGetSizeFn = unsafe fn(
    &mut tagPKImageDecode,
    Option<&mut i32>,
    Option<&mut i32>,
) -> Result<(), crate::WmpError>;
pub type PKImageDecodeGetResolutionFn = unsafe fn(
    &mut tagPKImageDecode,
    Option<&mut f32>,
    Option<&mut f32>,
) -> Result<(), crate::WmpError>;
pub type PKImageDecodeGetColorContextFn = unsafe fn(
    &mut tagPKImageDecode,
    Option<&mut [u8]>,
    Option<&mut u32>,
) -> Result<(), crate::WmpError>;
pub type PKImageDecodeGetDescriptiveMetadataFn = unsafe fn(
    &mut tagPKImageDecode,
    Option<&mut DESCRIPTIVEMETADATA>,
) -> Result<(), crate::WmpError>;
pub type PKImageDecodeGetRawStreamFn =
    unsafe fn(&mut tagPKImageDecode) -> Result<NonNull<WMPStream>, crate::WmpError>;
pub type PKImageDecodeCopyFn = unsafe fn(
    &mut tagPKImageDecode,
    Option<&tagPKRect>,
    &mut [u8],
    u32,
) -> Result<(), crate::WmpError>;
pub type PKImageDecodeGetFrameCountFn =
    unsafe fn(&mut tagPKImageDecode, Option<&mut u32>) -> Result<(), crate::WmpError>;
pub type PKImageDecodeSelectFrameFn =
    unsafe fn(&mut tagPKImageDecode, u32) -> Result<(), crate::WmpError>;
pub type PKImageEncodeInitializeFn = unsafe fn(
    &mut tagPKImageEncode,
    &mut WMPStream,
    Option<&tagWmpStrCodecParam>,
    usize,
) -> Result<(), crate::WmpError>;
pub type PKImageEncodeTerminateFn = unsafe fn(&mut tagPKImageEncode) -> Result<(), crate::WmpError>;
pub type PKImageEncodeSetPixelFormatFn =
    unsafe fn(&mut tagPKImageEncode, PKPixelFormatGUID) -> Result<(), crate::WmpError>;
pub type PKImageEncodeSetSizeFn =
    unsafe fn(&mut tagPKImageEncode, i32, i32) -> Result<(), crate::WmpError>;
pub type PKImageEncodeSetResolutionFn =
    unsafe fn(&mut tagPKImageEncode, f32, f32) -> Result<(), crate::WmpError>;
pub type PKImageEncodeSetColorContextFn =
    unsafe fn(&mut tagPKImageEncode, Option<&[u8]>) -> Result<(), crate::WmpError>;
pub type PKImageEncodeSetDescriptiveMetadataFn =
    unsafe fn(&mut tagPKImageEncode, Option<&DESCRIPTIVEMETADATA>) -> Result<(), crate::WmpError>;
pub type PKImageEncodeWritePixelsFn =
    unsafe fn(&mut tagPKImageEncode, u32, &[u8], u32) -> Result<(), crate::WmpError>;
pub type PKImageEncodeWriteSourceFn = unsafe fn(
    &mut tagPKImageEncode,
    *mut tagPKFormatConverter,
    *mut tagPKRect,
) -> Result<(), crate::WmpError>;
pub type PKImageEncodeWritePixelsBandedBeginFn =
    unsafe fn(&mut tagPKImageEncode, Option<&mut WMPStream>) -> Result<(), crate::WmpError>;
pub type PKImageEncodeWritePixelsBandedFn =
    unsafe fn(&mut tagPKImageEncode, u32, *mut u8, u32, i32) -> Result<(), crate::WmpError>;
pub type PKImageEncodeWritePixelsBandedEndFn =
    unsafe fn(&mut tagPKImageEncode) -> Result<(), crate::WmpError>;
pub type PKImageEncodeTranscodeFn = unsafe fn(
    &mut tagPKImageEncode,
    *mut tagPKImageDecode,
    *mut tagCWMTranscodingParam,
) -> Result<(), crate::WmpError>;
pub type PKImageEncodeCreateNewFrameFn =
    unsafe fn(&mut tagPKImageEncode) -> Result<(), crate::WmpError>;

pub const LOOKUP_FORWARD: u8 = 0;
pub const LOOKUP_BACKWARD_TIF: u8 = 1;

pub static IID_PKImageScanEncode: PkIid = PkIid::ImageScanEncode;
pub static IID_PKImageFrameEncode: PkIid = PkIid::ImageFrameEncode;
pub static IID_PKImageUnsupported: PkIid = PkIid::ImageUnsupported;
pub static IID_PKImageWmpEncode: PkIid = PkIid::ImageWmpEncode;
pub static IID_PKImageWmpDecode: PkIid = PkIid::ImageWmpDecode;

#[derive(Debug)]
pub enum PKCodec {
    Encode(Box<tagPKImageEncode>),
    Decode(Box<tagPKImageDecode>),
}

static SZ_EXT_JXR: &str = "jxr";
static SZ_EXT_WDP: &str = "wdp";
static SZ_EXT_HDP: &str = "hdp";

macro_rules! guid {
    ($data1:expr, $data2:expr, $data3:expr, $d0:expr, $d1:expr, $d2:expr, $d3:expr, $d4:expr, $d5:expr, $d6:expr, $d7:expr) => {
        GUID {
            data1: $data1,
            data2: $data2,
            data3: $data3,
            data4: [$d0, $d1, $d2, $d3, $d4, $d5, $d6, $d7],
        }
    };
}

macro_rules! pk_guid {
    ($hash:expr) => {
        guid!(0x6fddc324, 0x4e03, 0x4bfe, 0xb1, 0x85, 0x3d, 0x77, 0x76, 0x8d, 0xc9, $hash)
    };
}

pub static GUID_PKPixelFormatDontCare: GUID = pk_guid!(0x00);
pub static GUID_PKPixelFormatBlackWhite: GUID = pk_guid!(0x05);
pub static GUID_PKPixelFormat8bppGray: GUID = pk_guid!(0x08);
pub static GUID_PKPixelFormat16bppGray: GUID = pk_guid!(0x0b);
pub static GUID_PKPixelFormat16bppGrayFixedPoint: GUID = pk_guid!(0x13);
pub static GUID_PKPixelFormat16bppGrayHalf: GUID = pk_guid!(0x3e);
pub static GUID_PKPixelFormat32bppGrayFixedPoint: GUID = pk_guid!(0x3f);
pub static GUID_PKPixelFormat32bppGrayFloat: GUID = pk_guid!(0x11);
pub static GUID_PKPixelFormat24bppRGB: GUID = pk_guid!(0x0d);
pub static GUID_PKPixelFormat24bppBGR: GUID = pk_guid!(0x0c);
pub static GUID_PKPixelFormat32bppRGB: GUID =
    guid!(0xd98c6b95, 0x3efe, 0x47d6, 0xbb, 0x25, 0xeb, 0x17, 0x48, 0xab, 0x0c, 0xf1);
pub static GUID_PKPixelFormat32bppBGR: GUID = pk_guid!(0x0e);
pub static GUID_PKPixelFormat48bppRGB: GUID = pk_guid!(0x15);
pub static GUID_PKPixelFormat48bppRGBFixedPoint: GUID = pk_guid!(0x12);
pub static GUID_PKPixelFormat48bppRGBHalf: GUID = pk_guid!(0x3b);
pub static GUID_PKPixelFormat64bppRGBFixedPoint: GUID = pk_guid!(0x40);
pub static GUID_PKPixelFormat64bppRGBHalf: GUID = pk_guid!(0x42);
pub static GUID_PKPixelFormat96bppRGBFixedPoint: GUID = pk_guid!(0x18);
pub static GUID_PKPixelFormat96bppRGBFloat: GUID =
    guid!(0xe3fed78f, 0xe8db, 0x4acf, 0x84, 0xc1, 0xe9, 0x7f, 0x61, 0x36, 0xb3, 0x27);
pub static GUID_PKPixelFormat128bppRGBFixedPoint: GUID = pk_guid!(0x41);
pub static GUID_PKPixelFormat128bppRGBFloat: GUID = pk_guid!(0x1b);
pub static GUID_PKPixelFormat32bppBGRA: GUID = pk_guid!(0x0f);
pub static GUID_PKPixelFormat32bppRGBA: GUID =
    guid!(0xf5c7ad2d, 0x6a8d, 0x43dd, 0xa7, 0xa8, 0xa2, 0x99, 0x35, 0x26, 0x1a, 0xe9);
pub static GUID_PKPixelFormat64bppRGBA: GUID = pk_guid!(0x16);
pub static GUID_PKPixelFormat64bppRGBAFixedPoint: GUID = pk_guid!(0x1d);
pub static GUID_PKPixelFormat64bppRGBAHalf: GUID = pk_guid!(0x3a);
pub static GUID_PKPixelFormat128bppRGBAFixedPoint: GUID = pk_guid!(0x1e);
pub static GUID_PKPixelFormat128bppRGBAFloat: GUID = pk_guid!(0x19);
pub static GUID_PKPixelFormat32bppPBGRA: GUID = pk_guid!(0x10);
pub static GUID_PKPixelFormat32bppPRGBA: GUID =
    guid!(0x3cc4a650, 0xa527, 0x4d37, 0xa9, 0x16, 0x31, 0x42, 0xc7, 0xeb, 0xed, 0xba);
pub static GUID_PKPixelFormat64bppPRGBA: GUID = pk_guid!(0x17);
pub static GUID_PKPixelFormat128bppPRGBAFloat: GUID = pk_guid!(0x1a);
pub static GUID_PKPixelFormat16bppRGB555: GUID = pk_guid!(0x09);
pub static GUID_PKPixelFormat16bppRGB565: GUID = pk_guid!(0x0a);
pub static GUID_PKPixelFormat32bppRGB101010: GUID = pk_guid!(0x14);
pub static GUID_PKPixelFormat32bppCMYK: GUID = pk_guid!(0x1c);
pub static GUID_PKPixelFormat40bppCMYKAlpha: GUID = pk_guid!(0x2c);
pub static GUID_PKPixelFormat64bppCMYK: GUID = pk_guid!(0x1f);
pub static GUID_PKPixelFormat80bppCMYKAlpha: GUID = pk_guid!(0x2d);
pub static GUID_PKPixelFormat24bpp3Channels: GUID = pk_guid!(0x20);
pub static GUID_PKPixelFormat32bpp4Channels: GUID = pk_guid!(0x21);
pub static GUID_PKPixelFormat40bpp5Channels: GUID = pk_guid!(0x22);
pub static GUID_PKPixelFormat48bpp6Channels: GUID = pk_guid!(0x23);
pub static GUID_PKPixelFormat56bpp7Channels: GUID = pk_guid!(0x24);
pub static GUID_PKPixelFormat64bpp8Channels: GUID = pk_guid!(0x25);
pub static GUID_PKPixelFormat32bpp3ChannelsAlpha: GUID = pk_guid!(0x2e);
pub static GUID_PKPixelFormat40bpp4ChannelsAlpha: GUID = pk_guid!(0x2f);
pub static GUID_PKPixelFormat48bpp5ChannelsAlpha: GUID = pk_guid!(0x30);
pub static GUID_PKPixelFormat56bpp6ChannelsAlpha: GUID = pk_guid!(0x31);
pub static GUID_PKPixelFormat64bpp7ChannelsAlpha: GUID = pk_guid!(0x32);
pub static GUID_PKPixelFormat72bpp8ChannelsAlpha: GUID = pk_guid!(0x33);
pub static GUID_PKPixelFormat48bpp3Channels: GUID = pk_guid!(0x26);
pub static GUID_PKPixelFormat64bpp4Channels: GUID = pk_guid!(0x27);
pub static GUID_PKPixelFormat80bpp5Channels: GUID = pk_guid!(0x28);
pub static GUID_PKPixelFormat96bpp6Channels: GUID = pk_guid!(0x29);
pub static GUID_PKPixelFormat112bpp7Channels: GUID = pk_guid!(0x2a);
pub static GUID_PKPixelFormat128bpp8Channels: GUID = pk_guid!(0x2b);
pub static GUID_PKPixelFormat64bpp3ChannelsAlpha: GUID = pk_guid!(0x34);
pub static GUID_PKPixelFormat80bpp4ChannelsAlpha: GUID = pk_guid!(0x35);
pub static GUID_PKPixelFormat96bpp5ChannelsAlpha: GUID = pk_guid!(0x36);
pub static GUID_PKPixelFormat112bpp6ChannelsAlpha: GUID = pk_guid!(0x37);
pub static GUID_PKPixelFormat128bpp7ChannelsAlpha: GUID = pk_guid!(0x38);
pub static GUID_PKPixelFormat144bpp8ChannelsAlpha: GUID = pk_guid!(0x39);
pub static GUID_PKPixelFormat32bppRGBE: GUID = pk_guid!(0x3d);
pub static GUID_PKPixelFormat12bppYUV420: GUID = pk_guid!(0x44);
pub static GUID_PKPixelFormat16bppYUV422: GUID = pk_guid!(0x45);
pub static GUID_PKPixelFormat24bppYUV444: GUID = pk_guid!(0x48);

#[derive(Debug)]
pub struct PkAlignedAllocation {
    storage: Box<[u8]>,
    offset: usize,
    len: usize,
}

/// Original struct: `tagPKRect` at `original/jxrlib/jxrgluelib/JXRGlue.h:55`.
#[repr(C)]
#[derive(Debug, Clone, Copy, Default)]
pub struct tagPKRect {
    pub X: i32,
    pub Y: i32,
    pub Width: i32,
    pub Height: i32,
}

/// Original struct: `IFDEntry` at `original/jxrlib/jxrgluelib/JXRGlue.h:73`.
#[derive(Debug, Clone, Default)]
pub struct IFDEntry {
    pub uTag: u16,
    pub uType: u16,
    pub uCount: u32,
    pub uValue: u32,
}

/// Original struct: `tagPKPixelInfo` at `original/jxrlib/jxrgluelib/JXRGlue.h:268`.
#[derive(Debug, Clone, Copy, Default)]
pub struct tagPKPixelInfo {
    pub pGUIDPixFmt: Option<PKPixelFormatGUID>,
    pub cChannel: usize,
    pub cfColorFormat: ColorFormat,
    pub bdBitDepth: BitDepth,
    pub cbitUnit: u32,
    pub grBit: PixelFormatFlags,
    pub uInterpretation: PixelFormatInterpretation,
    pub uSamplePerPixel: u32,
    pub uBitsPerSample: u32,
    pub uSampleFormat: u32,
}

/// Original struct: `tagPKImageEncode` at `original/jxrlib/jxrgluelib/JXRGlue.h:380`.
#[repr(C)]
#[derive(Debug, Default)]
pub struct tagPKImageEncode {
    pub Initialize: Option<PKImageEncodeInitializeFn>,
    pub Terminate: Option<PKImageEncodeTerminateFn>,
    pub SetPixelFormat: Option<PKImageEncodeSetPixelFormatFn>,
    pub SetSize: Option<PKImageEncodeSetSizeFn>,
    pub SetResolution: Option<PKImageEncodeSetResolutionFn>,
    pub SetColorContext: Option<PKImageEncodeSetColorContextFn>,
    pub SetDescriptiveMetadata: Option<PKImageEncodeSetDescriptiveMetadataFn>,
    pub WritePixels: Option<PKImageEncodeWritePixelsFn>,
    pub WriteSource: Option<PKImageEncodeWriteSourceFn>,
    pub WritePixelsBandedBegin: Option<PKImageEncodeWritePixelsBandedBeginFn>,
    pub WritePixelsBanded: Option<PKImageEncodeWritePixelsBandedFn>,
    pub WritePixelsBandedEnd: Option<PKImageEncodeWritePixelsBandedEndFn>,
    pub Transcode: Option<PKImageEncodeTranscodeFn>,
    pub CreateNewFrame: Option<PKImageEncodeCreateNewFrameFn>,
    pub pStream: Option<NonNull<WMPStream>>,
    pub offStart: usize,
    pub guidPixFormat: PKPixelFormatGUID,
    pub uWidth: u32,
    pub uHeight: u32,
    pub idxCurrentLine: u32,
    pub fResX: f32,
    pub fResY: f32,
    pub cFrame: u32,
    pub fHeaderDone: bool,
    pub offPixel: usize,
    pub cbPixel: usize,
    pub cbColorContext: u32,
    pub colorContextMemory: Option<Box<[u8]>>,
    pub cbEXIFMetadataByteCount: u32,
    pub exifMetadataMemory: Option<Box<[u8]>>,
    pub cbGPSInfoMetadataByteCount: u32,
    pub gpsInfoMetadataMemory: Option<Box<[u8]>>,
    pub cbIPTCNAAMetadataByteCount: u32,
    pub iptcNAAMetadataMemory: Option<Box<[u8]>>,
    pub cbXMPMetadataByteCount: u32,
    pub xmpMetadataMemory: Option<Box<[u8]>>,
    pub cbPhotoshopMetadataByteCount: u32,
    pub photoshopMetadataMemory: Option<Box<[u8]>>,
    pub sDescMetadata: DESCRIPTIVEMETADATA,
    pub bWMP: bool,
    pub WMP: tagPKImageEncodeWMP,
}

/// Original nested struct: `tagPKImageEncode::WMP` at `original/jxrlib/jxrgluelib/JXRGlue.h:443`.
#[repr(C)]
#[derive(Debug, Default)]
pub struct tagPKImageEncodeWMP {
    pub wmiDEMisc: tagWmpDEMisc,
    pub wmiI: tagCWMImageInfo,
    pub wmiSCP: tagWmpStrCodecParam,
    pub ctxSC: Option<Box<CWMImageStrCodec>>,
    pub wmiI_Alpha: tagCWMImageInfo,
    pub wmiSCP_Alpha: tagWmpStrCodecParam,
    pub ctxSC_Alpha: Option<Box<CWMImageStrCodec>>,
    pub bHasAlpha: bool,
    pub nOffImage: i64,
    pub nCbImage: i64,
    pub nOffAlpha: i64,
    pub nCbAlpha: i64,
    pub oOrientation: Orientation,
    pub eBandedEncState: BandedEncodeState,
    pub pPATempFile: Option<NonNull<WMPStream>>,
}

/// Original struct: `tagPKImageDecode` at `original/jxrlib/jxrgluelib/JXRGlue.h:495`.
#[repr(C)]
#[derive(Debug, Default)]
pub struct tagPKImageDecode {
    pub Initialize: Option<PKImageDecodeInitializeFn>,
    pub GetPixelFormat: Option<PKImageDecodeGetPixelFormatFn>,
    pub GetSize: Option<PKImageDecodeGetSizeFn>,
    pub GetResolution: Option<PKImageDecodeGetResolutionFn>,
    pub GetColorContext: Option<PKImageDecodeGetColorContextFn>,
    pub GetDescriptiveMetadata: Option<PKImageDecodeGetDescriptiveMetadataFn>,
    pub GetRawStream: Option<PKImageDecodeGetRawStreamFn>,
    pub Copy: Option<PKImageDecodeCopyFn>,
    pub GetFrameCount: Option<PKImageDecodeGetFrameCountFn>,
    pub SelectFrame: Option<PKImageDecodeSelectFrameFn>,
    pub pStream: Option<NonNull<WMPStream>>,
    pub pStreamMemory: Option<Box<WMPStream>>,
    pub offStart: usize,
    pub guidPixFormat: PKPixelFormatGUID,
    pub uWidth: u32,
    pub uHeight: u32,
    pub idxCurrentLine: u32,
    pub fResX: f32,
    pub fResY: f32,
    pub cFrame: u32,
    pub WMP: tagPKImageDecodeWMP,
}

/// Original nested struct: `tagPKImageDecode::WMP` at `original/jxrlib/jxrgluelib/JXRGlue.h:532`.
#[repr(C)]
#[derive(Debug, Default)]
pub struct tagPKImageDecodeWMP {
    pub wmiDEMisc: tagWmpDEMisc,
    pub wmiI: tagCWMImageInfo,
    pub wmiSCP: tagWmpStrCodecParam,
    pub ctxSC: Option<Box<CWMImageStrCodec>>,
    pub wmiI_Alpha: tagCWMImageInfo,
    pub wmiSCP_Alpha: tagWmpStrCodecParam,
    pub ctxSC_Alpha: Option<Box<CWMImageStrCodec>>,
    pub bHasAlpha: bool,
    pub nOffImage: i64,
    pub nCbImage: i64,
    pub nOffAlpha: i64,
    pub nCbAlpha: i64,
    pub bIgnoreOverlap: i32,
    pub DecoderCurrMBRow: usize,
    pub DecoderCurrAlphaMBRow: usize,
    pub cMarker: usize,
    pub cLinesDecoded: usize,
    pub cLinesCropped: usize,
    pub fFirstNonZeroDecode: bool,
    pub fOrientationFromContainer: bool,
    pub oOrientationFromContainer: Orientation,
    pub sDescMetadata: DESCRIPTIVEMETADATA,
}

/// Original type: `CWMIStrCodecParam` used from `original/jxrlib/jxrgluelib/JXRGlue.h`.
pub use crate::image::sys::windowsmediaphoto::tagCWMIStrCodecParam as tagWmpStrCodecParam;

/// Original struct: `tagPKFormatConverter` at `original/jxrlib/jxrgluelib/JXRGlue.h:589`.
#[repr(C)]
#[derive(Debug, Clone, Default)]
pub struct tagPKFormatConverter {
    pub Initialize: Option<PKFormatConverterInitializeFn>,
    pub InitializeConvert: Option<PKFormatConverterInitializeConvertFn>,
    pub GetPixelFormat: Option<PKFormatConverterGetPixelFormatFn>,
    pub GetSourcePixelFormat: Option<PKFormatConverterGetPixelFormatFn>,
    pub GetSize: Option<PKFormatConverterGetSizeFn>,
    pub GetResolution: Option<PKFormatConverterGetResolutionFn>,
    pub Copy: Option<PKFormatConverterCopyFn>,
    pub Convert: Option<PKPixelConverterFn>,
    pub pDecoder: Option<NonNull<tagPKImageDecode>>,
    pub enPixelFormat: PKPixelFormatGUID,
}

/// Original struct: `tagPKIIDInfo` at `original/jxrlib/jxrgluelib/JXRGlue.c:271`.
#[derive(Debug, Clone, Copy)]
pub struct tagPKIIDInfo {
    pub szExt: &'static str,
    pub pIIDEnc: PkIid,
    pub pIIDDec: PkIid,
}

static IID_INFO: [tagPKIIDInfo; 3] = [
    tagPKIIDInfo {
        szExt: SZ_EXT_JXR,
        pIIDEnc: IID_PKImageWmpEncode,
        pIIDDec: IID_PKImageWmpDecode,
    },
    tagPKIIDInfo {
        szExt: SZ_EXT_WDP,
        pIIDEnc: IID_PKImageUnsupported,
        pIIDDec: IID_PKImageWmpDecode,
    },
    tagPKIIDInfo {
        szExt: SZ_EXT_HDP,
        pIIDEnc: IID_PKImageUnsupported,
        pIIDDec: IID_PKImageWmpDecode,
    },
];

static PIXEL_INFO: [tagPKPixelInfo; 68] = [
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormatDontCare),
        cChannel: 1,
        cfColorFormat: ColorFormat::YOnly,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 8,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::WhiteIsZero,
        uSamplePerPixel: 0,
        uBitsPerSample: 0,
        uSampleFormat: 0,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormatBlackWhite),
        cChannel: 1,
        cfColorFormat: ColorFormat::YOnly,
        bdBitDepth: BitDepth::One,
        cbitUnit: 1,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::BlackIsZero,
        uSamplePerPixel: 1,
        uBitsPerSample: 1,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormatBlackWhite),
        cChannel: 1,
        cfColorFormat: ColorFormat::YOnly,
        bdBitDepth: BitDepth::One,
        cbitUnit: 1,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::WhiteIsZero,
        uSamplePerPixel: 1,
        uBitsPerSample: 1,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat8bppGray),
        cChannel: 1,
        cfColorFormat: ColorFormat::YOnly,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 8,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::BlackIsZero,
        uSamplePerPixel: 1,
        uBitsPerSample: 8,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat16bppGray),
        cChannel: 1,
        cfColorFormat: ColorFormat::YOnly,
        bdBitDepth: BitDepth::Sixteen,
        cbitUnit: 16,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::BlackIsZero,
        uSamplePerPixel: 1,
        uBitsPerSample: 16,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat16bppGrayFixedPoint),
        cChannel: 1,
        cfColorFormat: ColorFormat::YOnly,
        bdBitDepth: BitDepth::SixteenS,
        cbitUnit: 16,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::BlackIsZero,
        uSamplePerPixel: 1,
        uBitsPerSample: 16,
        uSampleFormat: 2,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat16bppGrayHalf),
        cChannel: 1,
        cfColorFormat: ColorFormat::YOnly,
        bdBitDepth: BitDepth::SixteenF,
        cbitUnit: 16,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::BlackIsZero,
        uSamplePerPixel: 1,
        uBitsPerSample: 16,
        uSampleFormat: 3,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat32bppGrayFixedPoint),
        cChannel: 1,
        cfColorFormat: ColorFormat::YOnly,
        bdBitDepth: BitDepth::ThirtyTwoS,
        cbitUnit: 32,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::BlackIsZero,
        uSamplePerPixel: 1,
        uBitsPerSample: 32,
        uSampleFormat: 2,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat32bppGrayFloat),
        cChannel: 1,
        cfColorFormat: ColorFormat::YOnly,
        bdBitDepth: BitDepth::ThirtyTwoF,
        cbitUnit: 32,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::BlackIsZero,
        uSamplePerPixel: 1,
        uBitsPerSample: 32,
        uSampleFormat: 3,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat24bppRGB),
        cChannel: 3,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 24,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 3,
        uBitsPerSample: 8,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat24bppBGR),
        cChannel: 3,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 24,
        grBit: PixelFormatFlags::BGR,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 3,
        uBitsPerSample: 8,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat32bppRGB),
        cChannel: 3,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 32,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 3,
        uBitsPerSample: 8,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat32bppBGR),
        cChannel: 3,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 32,
        grBit: PixelFormatFlags::BGR,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 3,
        uBitsPerSample: 8,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat48bppRGB),
        cChannel: 3,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::Sixteen,
        cbitUnit: 48,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 3,
        uBitsPerSample: 16,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat48bppRGBFixedPoint),
        cChannel: 3,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::SixteenS,
        cbitUnit: 48,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 3,
        uBitsPerSample: 16,
        uSampleFormat: 2,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat48bppRGBHalf),
        cChannel: 3,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::SixteenF,
        cbitUnit: 48,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 3,
        uBitsPerSample: 16,
        uSampleFormat: 3,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat64bppRGBFixedPoint),
        cChannel: 3,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::SixteenS,
        cbitUnit: 64,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 3,
        uBitsPerSample: 16,
        uSampleFormat: 2,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat64bppRGBHalf),
        cChannel: 3,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::SixteenF,
        cbitUnit: 64,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 3,
        uBitsPerSample: 16,
        uSampleFormat: 3,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat96bppRGBFixedPoint),
        cChannel: 3,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::ThirtyTwoS,
        cbitUnit: 96,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 3,
        uBitsPerSample: 32,
        uSampleFormat: 2,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat96bppRGBFloat),
        cChannel: 3,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::ThirtyTwoF,
        cbitUnit: 96,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 3,
        uBitsPerSample: 32,
        uSampleFormat: 3,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat128bppRGBFixedPoint),
        cChannel: 3,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::ThirtyTwoS,
        cbitUnit: 128,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 3,
        uBitsPerSample: 32,
        uSampleFormat: 2,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat128bppRGBFloat),
        cChannel: 3,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::ThirtyTwoF,
        cbitUnit: 128,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 3,
        uBitsPerSample: 32,
        uSampleFormat: 3,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat32bppBGRA),
        cChannel: 4,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 32,
        grBit: PixelFormatFlags::HAS_ALPHA_BGR,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 4,
        uBitsPerSample: 8,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat32bppRGBA),
        cChannel: 4,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 32,
        grBit: PixelFormatFlags::HAS_ALPHA,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 4,
        uBitsPerSample: 8,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat64bppRGBA),
        cChannel: 4,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::Sixteen,
        cbitUnit: 64,
        grBit: PixelFormatFlags::HAS_ALPHA,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 4,
        uBitsPerSample: 16,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat64bppRGBAFixedPoint),
        cChannel: 4,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::SixteenS,
        cbitUnit: 64,
        grBit: PixelFormatFlags::HAS_ALPHA,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 4,
        uBitsPerSample: 16,
        uSampleFormat: 2,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat64bppRGBAHalf),
        cChannel: 4,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::SixteenF,
        cbitUnit: 64,
        grBit: PixelFormatFlags::HAS_ALPHA,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 4,
        uBitsPerSample: 16,
        uSampleFormat: 3,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat128bppRGBAFixedPoint),
        cChannel: 4,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::ThirtyTwoS,
        cbitUnit: 128,
        grBit: PixelFormatFlags::HAS_ALPHA,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 4,
        uBitsPerSample: 32,
        uSampleFormat: 2,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat128bppRGBAFloat),
        cChannel: 4,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::ThirtyTwoF,
        cbitUnit: 128,
        grBit: PixelFormatFlags::HAS_ALPHA,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 4,
        uBitsPerSample: 32,
        uSampleFormat: 3,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat32bppPBGRA),
        cChannel: 4,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 32,
        grBit: PixelFormatFlags::HAS_ALPHA_PRE_MULTIPLIED_BGR,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 4,
        uBitsPerSample: 8,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat32bppPRGBA),
        cChannel: 4,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 32,
        grBit: PixelFormatFlags::HAS_ALPHA_PRE_MULTIPLIED,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 4,
        uBitsPerSample: 8,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat64bppPRGBA),
        cChannel: 4,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::Sixteen,
        cbitUnit: 64,
        grBit: PixelFormatFlags::HAS_ALPHA_PRE_MULTIPLIED,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 4,
        uBitsPerSample: 16,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat128bppPRGBAFloat),
        cChannel: 4,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::ThirtyTwoF,
        cbitUnit: 128,
        grBit: PixelFormatFlags::HAS_ALPHA_PRE_MULTIPLIED,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 4,
        uBitsPerSample: 32,
        uSampleFormat: 3,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat16bppRGB555),
        cChannel: 3,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::Five,
        cbitUnit: 16,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 3,
        uBitsPerSample: 5,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat16bppRGB565),
        cChannel: 3,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::FiveSixFive,
        cbitUnit: 16,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 3,
        uBitsPerSample: 6,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat32bppRGB101010),
        cChannel: 3,
        cfColorFormat: ColorFormat::Rgb,
        bdBitDepth: BitDepth::Ten,
        cbitUnit: 32,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::Rgb,
        uSamplePerPixel: 3,
        uBitsPerSample: 10,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat32bppCMYK),
        cChannel: 4,
        cfColorFormat: ColorFormat::Cmyk,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 32,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::Cmyk,
        uSamplePerPixel: 4,
        uBitsPerSample: 8,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat40bppCMYKAlpha),
        cChannel: 5,
        cfColorFormat: ColorFormat::Cmyk,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 40,
        grBit: PixelFormatFlags::HAS_ALPHA,
        uInterpretation: PixelFormatInterpretation::Cmyk,
        uSamplePerPixel: 5,
        uBitsPerSample: 8,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat64bppCMYK),
        cChannel: 4,
        cfColorFormat: ColorFormat::Cmyk,
        bdBitDepth: BitDepth::Sixteen,
        cbitUnit: 64,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::Cmyk,
        uSamplePerPixel: 4,
        uBitsPerSample: 16,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat80bppCMYKAlpha),
        cChannel: 5,
        cfColorFormat: ColorFormat::Cmyk,
        bdBitDepth: BitDepth::Sixteen,
        cbitUnit: 80,
        grBit: PixelFormatFlags::HAS_ALPHA,
        uInterpretation: PixelFormatInterpretation::Cmyk,
        uSamplePerPixel: 5,
        uBitsPerSample: 16,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat24bpp3Channels),
        cChannel: 3,
        cfColorFormat: ColorFormat::NComponent,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 24,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::NChannel,
        uSamplePerPixel: 3,
        uBitsPerSample: 8,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat32bpp4Channels),
        cChannel: 4,
        cfColorFormat: ColorFormat::NComponent,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 32,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::NChannel,
        uSamplePerPixel: 4,
        uBitsPerSample: 8,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat40bpp5Channels),
        cChannel: 5,
        cfColorFormat: ColorFormat::NComponent,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 40,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::NChannel,
        uSamplePerPixel: 5,
        uBitsPerSample: 8,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat48bpp6Channels),
        cChannel: 6,
        cfColorFormat: ColorFormat::NComponent,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 48,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::NChannel,
        uSamplePerPixel: 6,
        uBitsPerSample: 8,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat56bpp7Channels),
        cChannel: 7,
        cfColorFormat: ColorFormat::NComponent,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 56,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::NChannel,
        uSamplePerPixel: 7,
        uBitsPerSample: 8,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat64bpp8Channels),
        cChannel: 8,
        cfColorFormat: ColorFormat::NComponent,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 64,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::NChannel,
        uSamplePerPixel: 8,
        uBitsPerSample: 8,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat32bpp3ChannelsAlpha),
        cChannel: 4,
        cfColorFormat: ColorFormat::NComponent,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 32,
        grBit: PixelFormatFlags::HAS_ALPHA,
        uInterpretation: PixelFormatInterpretation::NChannel,
        uSamplePerPixel: 4,
        uBitsPerSample: 8,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat40bpp4ChannelsAlpha),
        cChannel: 5,
        cfColorFormat: ColorFormat::NComponent,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 40,
        grBit: PixelFormatFlags::HAS_ALPHA,
        uInterpretation: PixelFormatInterpretation::NChannel,
        uSamplePerPixel: 5,
        uBitsPerSample: 8,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat48bpp5ChannelsAlpha),
        cChannel: 6,
        cfColorFormat: ColorFormat::NComponent,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 48,
        grBit: PixelFormatFlags::HAS_ALPHA,
        uInterpretation: PixelFormatInterpretation::NChannel,
        uSamplePerPixel: 6,
        uBitsPerSample: 8,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat56bpp6ChannelsAlpha),
        cChannel: 7,
        cfColorFormat: ColorFormat::NComponent,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 56,
        grBit: PixelFormatFlags::HAS_ALPHA,
        uInterpretation: PixelFormatInterpretation::NChannel,
        uSamplePerPixel: 7,
        uBitsPerSample: 8,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat64bpp7ChannelsAlpha),
        cChannel: 8,
        cfColorFormat: ColorFormat::NComponent,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 64,
        grBit: PixelFormatFlags::HAS_ALPHA,
        uInterpretation: PixelFormatInterpretation::NChannel,
        uSamplePerPixel: 8,
        uBitsPerSample: 8,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat72bpp8ChannelsAlpha),
        cChannel: 9,
        cfColorFormat: ColorFormat::NComponent,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 72,
        grBit: PixelFormatFlags::HAS_ALPHA,
        uInterpretation: PixelFormatInterpretation::NChannel,
        uSamplePerPixel: 9,
        uBitsPerSample: 8,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat48bpp3Channels),
        cChannel: 3,
        cfColorFormat: ColorFormat::NComponent,
        bdBitDepth: BitDepth::Sixteen,
        cbitUnit: 48,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::NChannel,
        uSamplePerPixel: 3,
        uBitsPerSample: 16,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat64bpp4Channels),
        cChannel: 4,
        cfColorFormat: ColorFormat::NComponent,
        bdBitDepth: BitDepth::Sixteen,
        cbitUnit: 64,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::NChannel,
        uSamplePerPixel: 4,
        uBitsPerSample: 16,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat80bpp5Channels),
        cChannel: 5,
        cfColorFormat: ColorFormat::NComponent,
        bdBitDepth: BitDepth::Sixteen,
        cbitUnit: 80,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::NChannel,
        uSamplePerPixel: 5,
        uBitsPerSample: 16,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat96bpp6Channels),
        cChannel: 6,
        cfColorFormat: ColorFormat::NComponent,
        bdBitDepth: BitDepth::Sixteen,
        cbitUnit: 96,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::NChannel,
        uSamplePerPixel: 6,
        uBitsPerSample: 16,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat112bpp7Channels),
        cChannel: 7,
        cfColorFormat: ColorFormat::NComponent,
        bdBitDepth: BitDepth::Sixteen,
        cbitUnit: 112,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::NChannel,
        uSamplePerPixel: 7,
        uBitsPerSample: 16,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat128bpp8Channels),
        cChannel: 8,
        cfColorFormat: ColorFormat::NComponent,
        bdBitDepth: BitDepth::Sixteen,
        cbitUnit: 128,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::NChannel,
        uSamplePerPixel: 8,
        uBitsPerSample: 16,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat64bpp3ChannelsAlpha),
        cChannel: 4,
        cfColorFormat: ColorFormat::NComponent,
        bdBitDepth: BitDepth::Sixteen,
        cbitUnit: 64,
        grBit: PixelFormatFlags::HAS_ALPHA,
        uInterpretation: PixelFormatInterpretation::NChannel,
        uSamplePerPixel: 4,
        uBitsPerSample: 16,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat80bpp4ChannelsAlpha),
        cChannel: 5,
        cfColorFormat: ColorFormat::NComponent,
        bdBitDepth: BitDepth::Sixteen,
        cbitUnit: 80,
        grBit: PixelFormatFlags::HAS_ALPHA,
        uInterpretation: PixelFormatInterpretation::NChannel,
        uSamplePerPixel: 5,
        uBitsPerSample: 16,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat96bpp5ChannelsAlpha),
        cChannel: 6,
        cfColorFormat: ColorFormat::NComponent,
        bdBitDepth: BitDepth::Sixteen,
        cbitUnit: 96,
        grBit: PixelFormatFlags::HAS_ALPHA,
        uInterpretation: PixelFormatInterpretation::NChannel,
        uSamplePerPixel: 6,
        uBitsPerSample: 16,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat112bpp6ChannelsAlpha),
        cChannel: 7,
        cfColorFormat: ColorFormat::NComponent,
        bdBitDepth: BitDepth::Sixteen,
        cbitUnit: 112,
        grBit: PixelFormatFlags::HAS_ALPHA,
        uInterpretation: PixelFormatInterpretation::NChannel,
        uSamplePerPixel: 7,
        uBitsPerSample: 16,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat128bpp7ChannelsAlpha),
        cChannel: 8,
        cfColorFormat: ColorFormat::NComponent,
        bdBitDepth: BitDepth::Sixteen,
        cbitUnit: 128,
        grBit: PixelFormatFlags::HAS_ALPHA,
        uInterpretation: PixelFormatInterpretation::NChannel,
        uSamplePerPixel: 8,
        uBitsPerSample: 16,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat144bpp8ChannelsAlpha),
        cChannel: 9,
        cfColorFormat: ColorFormat::NComponent,
        bdBitDepth: BitDepth::Sixteen,
        cbitUnit: 144,
        grBit: PixelFormatFlags::HAS_ALPHA,
        uInterpretation: PixelFormatInterpretation::NChannel,
        uSamplePerPixel: 9,
        uBitsPerSample: 16,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat32bppRGBE),
        cChannel: 4,
        cfColorFormat: ColorFormat::Rgbe,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 32,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::Rgbe,
        uSamplePerPixel: 4,
        uBitsPerSample: 8,
        uSampleFormat: 1,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat12bppYUV420),
        cChannel: 3,
        cfColorFormat: ColorFormat::Yuv420,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 48,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::WhiteIsZero,
        uSamplePerPixel: 0,
        uBitsPerSample: 0,
        uSampleFormat: 0,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat16bppYUV422),
        cChannel: 3,
        cfColorFormat: ColorFormat::Yuv422,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 32,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::WhiteIsZero,
        uSamplePerPixel: 0,
        uBitsPerSample: 0,
        uSampleFormat: 0,
    },
    tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormat24bppYUV444),
        cChannel: 3,
        cfColorFormat: ColorFormat::Yuv444,
        bdBitDepth: BitDepth::Eight,
        cbitUnit: 24,
        grBit: PixelFormatFlags::NONE,
        uInterpretation: PixelFormatInterpretation::WhiteIsZero,
        uSamplePerPixel: 0,
        uBitsPerSample: 0,
        uSampleFormat: 0,
    },
];

/// Original function: `PKAlloc` at `original/jxrlib/jxrgluelib/JXRGlue.c:46`.
pub unsafe fn pk_alloc(cb: usize) -> Result<Box<[u8]>, crate::WmpError> {
    let mut storage = Vec::new();
    if storage.try_reserve_exact(cb).is_err() {
        return Err(crate::WmpError::OutOfMemory);
    }
    storage.resize(cb, 0);
    Ok(storage.into_boxed_slice())
}

/// Original function: `PKFree` at `original/jxrlib/jxrgluelib/JXRGlue.c:53`.
pub unsafe fn pk_free(ppv: &mut Option<Box<[u8]>>) -> Result<(), crate::WmpError> {
    *ppv = None;
    Ok(())
}

/// Original function: `PKAllocAligned` at `original/jxrlib/jxrgluelib/JXRGlue.c:64`.
pub unsafe fn pk_alloc_aligned(
    cb: usize,
    iAlign: usize,
) -> Result<PkAlignedAllocation, crate::WmpError> {
    if iAlign == 0 {
        return Err(crate::WmpError::OutOfMemory);
    }

    let Some(storage_len) = cb.checked_add(iAlign).and_then(|size| size.checked_sub(1)) else {
        return Err(crate::WmpError::OutOfMemory);
    };

    let mut storage = Vec::new();
    if storage.try_reserve_exact(storage_len).is_err() {
        return Err(crate::WmpError::OutOfMemory);
    }
    storage.resize(storage_len, 0);
    let mut storage = storage.into_boxed_slice();
    let base = storage.as_mut_ptr() as usize;
    let offset = (iAlign - (base % iAlign)) % iAlign;

    debug_assert!(offset + cb <= storage.len());
    debug_assert_eq!((base + offset) % iAlign, 0);

    Ok(PkAlignedAllocation {
        storage,
        offset,
        len: cb,
    })
}

/// Original function: `PKFreeAligned` at `original/jxrlib/jxrgluelib/JXRGlue.c:92`.
pub unsafe fn pk_free_aligned(
    ppv: &mut Option<PkAlignedAllocation>,
) -> Result<(), crate::WmpError> {
    *ppv = None;
    Ok(())
}

/// Original function: `PKStrnicmp` at `original/jxrlib/jxrgluelib/JXRGlue.c:106`.
pub fn pk_strnicmp(s1: &[u8], s2: &[u8], c: usize) -> i32 {
    for i in 0..c {
        let left = s1.get(i).copied().unwrap_or(0);
        let right = s2.get(i).copied().unwrap_or(0);
        if left.to_ascii_lowercase() != right.to_ascii_lowercase() || left == 0 || right == 0 {
            return (left as i32) - (right as i32);
        }
    }

    0
}

/// Original function: `PixelFormatLookup` at `original/jxrlib/jxrgluelib/JXRGlue.c:217`.
pub unsafe fn pixel_format_lookup(
    pixel_info: &mut tagPKPixelInfo,
    uLookupType: u8,
) -> Result<(), crate::WmpError> {
    for candidate in PIXEL_INFO {
        if LOOKUP_FORWARD == uLookupType {
            if pixel_info.pGUIDPixFmt == candidate.pGUIDPixFmt {
                *pixel_info = candidate;
                return Ok(());
            }
        } else if LOOKUP_BACKWARD_TIF == uLookupType
            && pixel_info.uSamplePerPixel == candidate.uSamplePerPixel
            && pixel_info.uBitsPerSample == candidate.uBitsPerSample
            && pixel_info.uSampleFormat == candidate.uSampleFormat
            && pixel_info.uInterpretation == candidate.uInterpretation
            && (pixel_info.grBit & (PixelFormatFlags::HAS_ALPHA | PixelFormatFlags::PRE_MULTIPLIED))
                == (candidate.grBit
                    & (PixelFormatFlags::HAS_ALPHA | PixelFormatFlags::PRE_MULTIPLIED))
        {
            *pixel_info = candidate;
            return Ok(());
        }
    }
    Err(crate::WmpError::UnsupportedFormat)
}

/// Original function: `GetPixelFormatFromHash` at `original/jxrlib/jxrgluelib/JXRGlue.c:256`.
pub unsafe fn get_pixel_format_from_hash(uPFHash: u8) -> Option<&'static PKPixelFormatGUID> {
    for pixel_info in &PIXEL_INFO {
        if let Some(pixel_format) = pixel_info.pGUIDPixFmt.as_ref() {
            if pixel_format.data4[7] == uPFHash {
                return Some(pixel_format);
            }
        }
    }
    None
}

/// Original function: `GetIIDInfo` at `original/jxrlib/jxrgluelib/JXRGlue.c:278`.
pub unsafe fn get_iid_info(
    extension: Option<&OsStr>,
    ppInfo: Option<&mut *const tagPKIIDInfo>,
) -> Result<(), crate::WmpError> {
    let Some(out) = ppInfo else {
        return Err(crate::WmpError::InvalidParameter);
    };
    *out = std::ptr::null();
    let Some(extension) = extension else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(extension) = extension.to_str() else {
        return Err(crate::WmpError::UnsupportedFormat);
    };

    for info in &IID_INFO {
        if extension.len() >= info.szExt.len()
            && extension[..info.szExt.len()].eq_ignore_ascii_case(info.szExt)
        {
            *out = info;
            return Ok(());
        }
    }

    Err(crate::WmpError::UnsupportedFormat)
}

/// Original function: `GetImageEncodeIID` at `original/jxrlib/jxrgluelib/JXRGlue.c:305`.
pub unsafe fn get_image_encode_iid(
    extension: Option<&OsStr>,
    ppIID: Option<&mut *const PkIid>,
) -> Result<(), crate::WmpError> {
    let Some(out) = ppIID else {
        return Err(crate::WmpError::InvalidParameter);
    };
    *out = std::ptr::null();
    let mut info = std::ptr::null();

    get_iid_info(extension, Some(&mut info))?;
    if info.is_null() {
        return Err(crate::WmpError::UnsupportedFormat);
    }
    *out = std::ptr::addr_of!((*info).pIIDEnc);

    Ok(())
}

/// Original function: `GetImageDecodeIID` at `original/jxrlib/jxrgluelib/JXRGlue.c:318`.
pub unsafe fn get_image_decode_iid(
    extension: Option<&OsStr>,
    ppIID: Option<&mut *const PkIid>,
) -> Result<(), crate::WmpError> {
    let Some(out) = ppIID else {
        return Err(crate::WmpError::InvalidParameter);
    };
    *out = std::ptr::null();
    let mut info = std::ptr::null();

    get_iid_info(extension, Some(&mut info))?;
    if info.is_null() {
        return Err(crate::WmpError::UnsupportedFormat);
    }
    *out = std::ptr::addr_of!((*info).pIIDDec);

    Ok(())
}

/// Original function: `PKCodecFactory_CreateCodec` at `original/jxrlib/jxrgluelib/JXRGlue.c:380`.
pub unsafe fn pk_codec_factory_create_codec(
    iid: *const PkIid,
    ppv: &mut Option<PKCodec>,
) -> Result<(), crate::WmpError> {
    *ppv = None;
    let Some(iid) = iid.as_ref() else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let iid = *iid;

    if IID_PKImageWmpEncode == iid {
        *ppv = Some(PKCodec::Encode(pk_image_encode_create_wmp_owned()));
        Ok(())
    } else if IID_PKImageWmpDecode == iid {
        *ppv = Some(PKCodec::Decode(pk_image_decode_create_wmp_owned()));
        Ok(())
    } else {
        Err(crate::WmpError::UnsupportedFormat)
    }
}

/// Original function: `PKCodecFactory_CreateDecoderFromFile` at `original/jxrlib/jxrgluelib/JXRGlue.c:401`.
pub unsafe fn pk_codec_factory_create_decoder_from_file(
    filename: Option<&Path>,
) -> Result<Box<tagPKImageDecode>, crate::WmpError> {
    let Some(filename) = filename else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(extension) = filename.extension() else {
        return Err(crate::WmpError::UnsupportedFormat);
    };

    let mut iid_ptr: *const PkIid = std::ptr::null();
    get_image_decode_iid(Some(extension), Some(&mut iid_ptr))?;
    if iid_ptr.is_null() {
        return Err(crate::WmpError::UnsupportedFormat);
    }

    let Ok(mut stream) = create_ws_file_owned(filename, WsFileMode::Read) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let mut codec: Option<PKCodec> = None;
    pk_codec_factory_create_codec(iid_ptr, &mut codec)?;
    let decoder = match codec {
        Some(PKCodec::Decode(decoder)) => decoder,
        Some(PKCodec::Encode(_encoder)) => return Err(crate::WmpError::UnsupportedFormat),
        None => return Err(crate::WmpError::UnsupportedFormat),
    };

    let mut decoder = decoder;
    let Some(initialize) = decoder.Initialize else {
        return Err(crate::WmpError::AbstractMethod);
    };
    initialize(&mut *decoder, stream.as_mut())?;
    decoder.pStreamMemory = Some(stream);

    Ok(decoder)
}

/// Original function: `PKCodecFactory_CreateFormatConverter` at `original/jxrlib/jxrgluelib/JXRGlue.c:433`.
pub unsafe fn pk_codec_factory_create_format_converter_owned() -> Box<tagPKFormatConverter> {
    Box::new(tagPKFormatConverter {
        Initialize: Some(pk_format_converter_initialize),
        InitializeConvert: Some(pk_format_converter_initialize_convert),
        GetPixelFormat: Some(pk_format_converter_get_pixel_format),
        GetSourcePixelFormat: Some(pk_format_converter_get_source_pixel_format),
        GetSize: Some(pk_format_converter_get_size),
        GetResolution: Some(pk_format_converter_get_resolution),
        Copy: Some(pk_format_converter_copy),
        Convert: Some(pk_format_converter_convert),
        ..Default::default()
    })
}

/// Original function: `PKImageEncode_Initialize` at `original/jxrlib/jxrgluelib/JXRGlue.c:488`.
pub unsafe fn pk_image_encode_initialize(
    encoder: &mut tagPKImageEncode,
    pStream: &mut WMPStream,
    _param: Option<&tagWmpStrCodecParam>,
    _cbParam: usize,
) -> Result<(), crate::WmpError> {
    encoder.pStream = Some(NonNull::from(&mut *pStream));
    let mut stream = NonNull::from(pStream);
    encoder.guidPixFormat = GUID_PKPixelFormatDontCare;
    encoder.fResX = 96.0;
    encoder.fResY = 96.0;
    encoder.cFrame = 1;

    let Some(get_pos) = (*stream.as_ptr()).GetPos else {
        return Err(crate::WmpError::AbstractMethod);
    };
    get_pos(stream.as_mut(), &mut encoder.offStart)
}

/// Original function: `PKImageEncode_Terminate` at `original/jxrlib/jxrgluelib/JXRGlue.c:512`.
pub unsafe fn pk_image_encode_terminate(
    _encoder: &mut tagPKImageEncode,
) -> Result<(), crate::WmpError> {
    Ok(())
}

/// Original function: `PKImageEncode_SetPixelFormat` at `original/jxrlib/jxrgluelib/JXRGlue.c:519`.
pub unsafe fn pk_image_encode_set_pixel_format(
    encoder: &mut tagPKImageEncode,
    enPixelFormat: PKPixelFormatGUID,
) -> Result<(), crate::WmpError> {
    encoder.guidPixFormat = enPixelFormat;

    Ok(())
}

/// Original function: `PKImageEncode_SetSize` at `original/jxrlib/jxrgluelib/JXRGlue.c:528`.
pub unsafe fn pk_image_encode_set_size(
    encoder: &mut tagPKImageEncode,
    iWidth: i32,
    iHeight: i32,
) -> Result<(), crate::WmpError> {
    if iWidth <= 0 || iHeight <= 0 {
        return Err(crate::WmpError::InvalidParameter);
    }
    encoder.uWidth = iWidth as u32;
    encoder.uHeight = iHeight as u32;

    Ok(())
}

/// Original function: `PKImageEncode_SetResolution` at `original/jxrlib/jxrgluelib/JXRGlue.c:541`.
pub unsafe fn pk_image_encode_set_resolution(
    encoder: &mut tagPKImageEncode,
    fResX: f32,
    fResY: f32,
) -> Result<(), crate::WmpError> {
    encoder.fResX = fResX;
    encoder.fResY = fResY;

    Ok(())
}

/// Original function: `PKImageEncode_SetColorContext` at `original/jxrlib/jxrgluelib/JXRGlue.c:552`.
pub unsafe fn pk_image_encode_set_color_context(
    _encoder: &mut tagPKImageEncode,
    _colorContext: Option<&[u8]>,
) -> Result<(), crate::WmpError> {
    Err(crate::WmpError::NotYetImplemented)
}

/// Original function: `PKImageEncode_SetDescriptiveMetadata` at `original/jxrlib/jxrgluelib/JXRGlue.c:563`.
pub unsafe fn pk_image_encode_set_descriptive_metadata(
    _encoder: &mut tagPKImageEncode,
    _pDescMetadata: Option<&DESCRIPTIVEMETADATA>,
) -> Result<(), crate::WmpError> {
    Err(crate::WmpError::NotYetImplemented)
}

/// Original function: `PKImageEncode_WritePixels` at `original/jxrlib/jxrgluelib/JXRGlue.c:570`.
pub unsafe fn pk_image_encode_write_pixels(
    _encoder: &mut tagPKImageEncode,
    _cLine: u32,
    _pbPixels: &[u8],
    _cbStride: u32,
) -> Result<(), crate::WmpError> {
    Err(crate::WmpError::AbstractMethod)
}

/// Original function: `PKImageEncode_WriteSource` at `original/jxrlib/jxrgluelib/JXRGlue.c:583`.
pub unsafe fn pk_image_encode_write_source(
    encoder: &mut tagPKImageEncode,
    pFC: *mut tagPKFormatConverter,
    pRect: *mut tagPKRect,
) -> Result<(), crate::WmpError> {
    if pFC.is_null() || pRect.is_null() {
        return Err(crate::WmpError::InvalidParameter);
    }
    let converter = &mut *pFC;
    let rect = &*pRect;
    let mut enPFFrom = GUID_PKPixelFormatDontCare;
    let mut enPFTo = GUID_PKPixelFormatDontCare;

    let mut pixel_info_from = tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormatDontCare),
        ..Default::default()
    };
    let mut pixel_info_to = tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormatDontCare),
        ..Default::default()
    };

    let cbStrideTo: u32;
    let cbStrideFrom: u32;
    let cbStride: u32;

    let Some(get_source_pixel_format) = converter.GetSourcePixelFormat else {
        return Err(crate::WmpError::AbstractMethod);
    };
    let Some(get_pixel_format) = converter.GetPixelFormat else {
        return Err(crate::WmpError::AbstractMethod);
    };
    let Some(copy) = converter.Copy else {
        return Err(crate::WmpError::AbstractMethod);
    };
    let Some(write_pixels) = encoder.WritePixels else {
        return Err(crate::WmpError::AbstractMethod);
    };

    let mut err = get_source_pixel_format(converter, Some(&mut enPFFrom));
    if err.is_err() {
        return err;
    }
    err = get_pixel_format(converter, Some(&mut enPFTo));
    if err.is_err() {
        return err;
    }
    if encoder.guidPixFormat != enPFTo {
        return Err(crate::WmpError::UnsupportedFormat);
    }

    pixel_info_from.pGUIDPixFmt = Some(enPFFrom);
    pixel_format_lookup(&mut pixel_info_from, LOOKUP_FORWARD)?;

    pixel_info_to.pGUIDPixFmt = Some(enPFTo);
    pixel_format_lookup(&mut pixel_info_to, LOOKUP_FORWARD)?;

    let shift_from = u32::from(
        pixel_info_from.pGUIDPixFmt == Some(GUID_PKPixelFormat12bppYUV420)
            || pixel_info_from.pGUIDPixFmt == Some(GUID_PKPixelFormat16bppYUV422),
    );
    let shift_to = u32::from(
        pixel_info_to.pGUIDPixFmt == Some(GUID_PKPixelFormat12bppYUV420)
            || pixel_info_to.pGUIDPixFmt == Some(GUID_PKPixelFormat16bppYUV422),
    );

    cbStrideFrom = (if BitDepth::One == pixel_info_from.bdBitDepth {
        (pixel_info_from.cbitUnit * rect.Width as u32 + 7) >> 3
    } else {
        ((pixel_info_from.cbitUnit + 7) >> 3) * rect.Width as u32
    }) >> shift_from;

    cbStrideTo = (if BitDepth::One == pixel_info_to.bdBitDepth {
        (pixel_info_to.cbitUnit * encoder.uWidth + 7) >> 3
    } else {
        ((pixel_info_to.cbitUnit + 7) >> 3) * encoder.uWidth
    }) >> shift_to;

    cbStride = cbStrideFrom.max(cbStrideTo);

    #[repr(align(128))]
    #[derive(Clone, Copy)]
    struct AlignedBlock([u8; 128]);

    let Some(cb_buffer) = (cbStride as usize).checked_mul(rect.Height as usize) else {
        return Err(crate::WmpError::OutOfMemory);
    };
    let Some(block_count) = cb_buffer
        .checked_add(127)
        .map(|cb_buffer| (cb_buffer / 128).max(1))
    else {
        return Err(crate::WmpError::OutOfMemory);
    };
    let mut buffer = Vec::new();
    if buffer.try_reserve_exact(block_count).is_err() {
        return Err(crate::WmpError::OutOfMemory);
    }
    buffer.resize(block_count, AlignedBlock([0; 128]));
    let pb = buffer.as_mut_ptr().cast::<u8>();
    let pixels = std::slice::from_raw_parts_mut(pb, cb_buffer);

    err = copy(converter, Some(rect), pixels, cbStride);
    if err.is_err() {
        return err;
    }

    err = write_pixels(encoder, rect.Height as u32, pixels, cbStride);
    if err.is_err() {
        return err;
    }

    Ok(())
}

/// Original function: `PKImageEncode_WritePixelsBandedBegin` at `original/jxrlib/jxrgluelib/JXRGlue.c:644`.
pub unsafe fn pk_image_encode_write_pixels_banded_begin(
    _encoder: &mut tagPKImageEncode,
    _pPATempFile: Option<&mut WMPStream>,
) -> Result<(), crate::WmpError> {
    Err(crate::WmpError::AbstractMethod)
}

/// Original function: `PKImageEncode_WritePixelsBanded` at `original/jxrlib/jxrgluelib/JXRGlue.c:651`.
pub unsafe fn pk_image_encode_write_pixels_banded(
    _encoder: &mut tagPKImageEncode,
    _cLines: u32,
    _pbPixels: *mut u8,
    _cbStride: u32,
    _fLastCall: i32,
) -> Result<(), crate::WmpError> {
    Err(crate::WmpError::AbstractMethod)
}

/// Original function: `PKImageEncode_WritePixelsBandedEnd` at `original/jxrlib/jxrgluelib/JXRGlue.c:661`.
pub unsafe fn pk_image_encode_write_pixels_banded_end(
    _encoder: &mut tagPKImageEncode,
) -> Result<(), crate::WmpError> {
    Err(crate::WmpError::AbstractMethod)
}

/// Original function: `PKImageEncode_Transcode` at `original/jxrlib/jxrgluelib/JXRGlue.c:668`.
pub unsafe fn pk_image_encode_transcode(
    encoder: &mut tagPKImageEncode,
    pFC: *mut tagPKFormatConverter,
    pRect: *mut tagPKRect,
) -> Result<(), crate::WmpError> {
    if pFC.is_null() || pRect.is_null() {
        return Err(crate::WmpError::InvalidParameter);
    }
    let converter = &mut *pFC;
    let rect = &*pRect;
    let mut enPFFrom = GUID_PKPixelFormatDontCare;
    let mut enPFTo = GUID_PKPixelFormatDontCare;

    let mut pixel_info_from = tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormatDontCare),
        ..Default::default()
    };
    let mut pixel_info_to = tagPKPixelInfo {
        pGUIDPixFmt: Some(GUID_PKPixelFormatDontCare),
        ..Default::default()
    };

    let cbStrideTo: u32;
    let cbStrideFrom: u32;
    let cbStride: u32;
    let mut cParam = tagCWMTranscodingParam::default();

    let Some(get_source_pixel_format) = converter.GetSourcePixelFormat else {
        return Err(crate::WmpError::AbstractMethod);
    };
    let Some(get_pixel_format) = converter.GetPixelFormat else {
        return Err(crate::WmpError::AbstractMethod);
    };
    let Some(copy) = converter.Copy else {
        return Err(crate::WmpError::AbstractMethod);
    };
    let Some(write_pixels) = encoder.WritePixels else {
        return Err(crate::WmpError::AbstractMethod);
    };

    let mut err = get_source_pixel_format(converter, Some(&mut enPFFrom));
    if err.is_err() {
        return err;
    }
    err = get_pixel_format(converter, Some(&mut enPFTo));
    if err.is_err() {
        return err;
    }
    if encoder.guidPixFormat != enPFTo {
        return Err(crate::WmpError::UnsupportedFormat);
    }

    pixel_info_from.pGUIDPixFmt = Some(enPFFrom);
    pixel_format_lookup(&mut pixel_info_from, LOOKUP_FORWARD)?;

    pixel_info_to.pGUIDPixFmt = Some(enPFTo);
    pixel_format_lookup(&mut pixel_info_to, LOOKUP_FORWARD)?;

    let shift_from = u32::from(
        pixel_info_from.pGUIDPixFmt == Some(GUID_PKPixelFormat12bppYUV420)
            || pixel_info_from.pGUIDPixFmt == Some(GUID_PKPixelFormat16bppYUV422),
    );
    let shift_to = u32::from(
        pixel_info_to.pGUIDPixFmt == Some(GUID_PKPixelFormat12bppYUV420)
            || pixel_info_to.pGUIDPixFmt == Some(GUID_PKPixelFormat16bppYUV422),
    );

    cbStrideFrom = (if BitDepth::One == pixel_info_from.bdBitDepth {
        (pixel_info_from.cbitUnit.wrapping_mul(rect.Width as u32) + 7) >> 3
    } else {
        ((pixel_info_from.cbitUnit + 7) >> 3).wrapping_mul(rect.Width as u32)
    }) >> shift_from;

    cbStrideTo = (if BitDepth::One == pixel_info_to.bdBitDepth {
        (pixel_info_to.cbitUnit.wrapping_mul(encoder.uWidth) + 7) >> 3
    } else {
        ((pixel_info_to.cbitUnit + 7) >> 3).wrapping_mul(encoder.uWidth)
    }) >> shift_to;

    cbStride = cbStrideFrom.max(cbStrideTo);

    if encoder.bWMP {
        let Some(decoder) = converter.pDecoder else {
            return Err(crate::WmpError::InvalidParameter);
        };
        let decoder = decoder.as_ptr();
        let decoder_wmp = &(*decoder).WMP;
        cParam.cLeftX = decoder_wmp.wmiI.cROILeftX;
        cParam.cTopY = decoder_wmp.wmiI.cROITopY;
        cParam.cWidth = decoder_wmp.wmiI.cROIWidth;
        cParam.cHeight = decoder_wmp.wmiI.cROIHeight;
        cParam.oOrientation = decoder_wmp.wmiI.oOrientation;
        cParam.uAlphaMode = decoder_wmp.wmiSCP.uAlphaMode;
        cParam.bfBitstreamFormat = decoder_wmp.wmiSCP.bfBitstreamFormat;
        cParam.sbSubband = decoder_wmp.wmiSCP.sbSubband;
        cParam.bIgnoreOverlap = decoder_wmp.bIgnoreOverlap;

        let Some(transcode) = encoder.Transcode else {
            return Err(crate::WmpError::AbstractMethod);
        };
        err = transcode(encoder, decoder, &mut cParam);
        if err.is_err() {
            return err;
        }
    } else {
        #[repr(align(128))]
        #[derive(Clone, Copy)]
        struct AlignedBlock([u8; 128]);

        let Some(cb_buffer) = (cbStride as usize).checked_mul(rect.Height as usize) else {
            return Err(crate::WmpError::OutOfMemory);
        };
        let Some(block_count) = cb_buffer
            .checked_add(127)
            .map(|cb_buffer| (cb_buffer / 128).max(1))
        else {
            return Err(crate::WmpError::OutOfMemory);
        };
        let mut buffer = Vec::new();
        if buffer.try_reserve_exact(block_count).is_err() {
            return Err(crate::WmpError::OutOfMemory);
        }
        buffer.resize(block_count, AlignedBlock([0; 128]));
        let pb = buffer.as_mut_ptr().cast::<u8>();
        let pixels = std::slice::from_raw_parts_mut(pb, cb_buffer);

        err = copy(converter, Some(rect), pixels, cbStride);
        if err.is_err() {
            return err;
        }

        err = write_pixels(encoder, rect.Height as u32, pixels, cbStride);
        if err.is_err() {
            return err;
        }
    }

    Ok(())
}

/// Original function: `PKImageEncode_CreateNewFrame` at `original/jxrlib/jxrgluelib/JXRGlue.c:744`.
pub unsafe fn pk_image_encode_create_new_frame(
    _encoder: &mut tagPKImageEncode,
) -> Result<(), crate::WmpError> {
    Ok(())
}

/// Original function: `PKImageEncode_Create` at `original/jxrlib/jxrgluelib/JXRGlue.c:765`.
pub unsafe fn pk_image_encode_create_owned() -> Box<tagPKImageEncode> {
    Box::new(tagPKImageEncode {
        Initialize: Some(pk_image_encode_initialize),
        Terminate: Some(pk_image_encode_terminate),
        SetPixelFormat: Some(pk_image_encode_set_pixel_format),
        SetSize: Some(pk_image_encode_set_size),
        SetResolution: Some(pk_image_encode_set_resolution),
        SetColorContext: Some(pk_image_encode_set_color_context),
        SetDescriptiveMetadata: Some(pk_image_encode_set_descriptive_metadata),
        WritePixels: Some(pk_image_encode_write_pixels),
        WritePixelsBandedBegin: Some(pk_image_encode_write_pixels_banded_begin),
        WritePixelsBanded: Some(pk_image_encode_write_pixels_banded),
        WritePixelsBandedEnd: Some(pk_image_encode_write_pixels_banded_end),
        CreateNewFrame: Some(pk_image_encode_create_new_frame),
        bWMP: false,
        ..Default::default()
    })
}

/// Original function: `PKImageDecode_Initialize` at `original/jxrlib/jxrgluelib/JXRGlue.c:799`.
pub unsafe fn pk_image_decode_initialize(
    pID: &mut tagPKImageDecode,
    pStream: &mut WMPStream,
) -> Result<(), crate::WmpError> {
    let decoder = &mut *pID;

    decoder.pStream = Some(NonNull::from(&mut *pStream));
    let mut stream = NonNull::from(pStream);
    decoder.guidPixFormat = GUID_PKPixelFormatDontCare;
    decoder.fResX = 96.0;
    decoder.fResY = 96.0;
    decoder.cFrame = 1;

    let Some(get_pos) = (*stream.as_ptr()).GetPos else {
        return Err(crate::WmpError::AbstractMethod);
    };
    let err = get_pos(stream.as_mut(), &mut decoder.offStart);
    if err.is_err() {
        return Ok(());
    }

    decoder.WMP.wmiDEMisc = tagWmpDEMisc::default();

    Ok(())
}

/// Original function: `PKImageDecode_GetPixelFormat` at `original/jxrlib/jxrgluelib/JXRGlue.c:819`.
pub unsafe fn pk_image_decode_get_pixel_format(
    pID: &mut tagPKImageDecode,
    pPF: Option<&mut PKPixelFormatGUID>,
) -> Result<(), crate::WmpError> {
    let Some(pixel_format) = pPF else {
        return Err(crate::WmpError::InvalidParameter);
    };
    *pixel_format = (&*pID).guidPixFormat;

    Ok(())
}

/// Original function: `PKImageDecode_GetSize` at `original/jxrlib/jxrgluelib/JXRGlue.c:828`.
pub unsafe fn pk_image_decode_get_size(
    pID: &mut tagPKImageDecode,
    piWidth: Option<&mut i32>,
    piHeight: Option<&mut i32>,
) -> Result<(), crate::WmpError> {
    let decoder = &*pID;
    let Some(width) = piWidth else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(height) = piHeight else {
        return Err(crate::WmpError::InvalidParameter);
    };
    *width = decoder.uWidth as i32;
    *height = decoder.uHeight as i32;

    Ok(())
}

/// Original function: `PKImageDecode_GetResolution` at `original/jxrlib/jxrgluelib/JXRGlue.c:839`.
pub unsafe fn pk_image_decode_get_resolution(
    pID: &mut tagPKImageDecode,
    pfResX: Option<&mut f32>,
    pfResY: Option<&mut f32>,
) -> Result<(), crate::WmpError> {
    let decoder = &*pID;
    let Some(res_x) = pfResX else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(res_y) = pfResY else {
        return Err(crate::WmpError::InvalidParameter);
    };
    *res_x = decoder.fResX;
    *res_y = decoder.fResY;

    Ok(())
}

/// Original function: `PKImageDecode_GetColorContext` at `original/jxrlib/jxrgluelib/JXRGlue.c:850`.
pub unsafe fn pk_image_decode_get_color_context(
    _pID: &mut tagPKImageDecode,
    _pbColorContext: Option<&mut [u8]>,
    _pcbColorContext: Option<&mut u32>,
) -> Result<(), crate::WmpError> {
    Err(crate::WmpError::NotYetImplemented)
}

/// Original function: `PKImageDecode_GetDescriptiveMetadata` at `original/jxrlib/jxrgluelib/JXRGlue.c:858`.
pub unsafe fn pk_image_decode_get_descriptive_metadata(
    _pIE: &mut tagPKImageDecode,
    _pDescMetadata: Option<&mut DESCRIPTIVEMETADATA>,
) -> Result<(), crate::WmpError> {
    Err(crate::WmpError::NotYetImplemented)
}

/// Original function: `PKImageDecode_Copy` at `original/jxrlib/jxrgluelib/JXRGlue.c:865`.
pub unsafe fn pk_image_decode_copy(
    _pID: &mut tagPKImageDecode,
    _pRect: Option<&tagPKRect>,
    _pb: &mut [u8],
    _cbStride: u32,
) -> Result<(), crate::WmpError> {
    Err(crate::WmpError::AbstractMethod)
}

/// Original function: `PKImageDecode_GetFrameCount` at `original/jxrlib/jxrgluelib/JXRGlue.c:878`.
pub unsafe fn pk_image_decode_get_frame_count(
    pID: &mut tagPKImageDecode,
    puCount: Option<&mut u32>,
) -> Result<(), crate::WmpError> {
    let Some(count) = puCount else {
        return Err(crate::WmpError::InvalidParameter);
    };
    *count = (&*pID).cFrame;

    Ok(())
}

/// Original function: `PKImageDecode_SelectFrame` at `original/jxrlib/jxrgluelib/JXRGlue.c:887`.
pub unsafe fn pk_image_decode_select_frame(
    _pID: &mut tagPKImageDecode,
    _uFrame: u32,
) -> Result<(), crate::WmpError> {
    Ok(())
}

/// Original function: `PKImageDecode_Create` at `original/jxrlib/jxrgluelib/JXRGlue.c:907`.
pub unsafe fn pk_image_decode_create_owned() -> Box<tagPKImageDecode> {
    Box::new(tagPKImageDecode {
        Initialize: Some(pk_image_decode_initialize),
        GetPixelFormat: Some(pk_image_decode_get_pixel_format),
        GetSize: Some(pk_image_decode_get_size),
        GetResolution: Some(pk_image_decode_get_resolution),
        GetColorContext: Some(pk_image_decode_get_color_context),
        GetDescriptiveMetadata: Some(pk_image_decode_get_descriptive_metadata),
        Copy: Some(pk_image_decode_copy),
        GetFrameCount: Some(pk_image_decode_get_frame_count),
        SelectFrame: Some(pk_image_decode_select_frame),
        ..Default::default()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    static PFC_COPY_CALLS: AtomicU32 = AtomicU32::new(0);
    static PFC_CONVERT_CALLS: AtomicU32 = AtomicU32::new(0);
    use crate::image::sys::strcodec::create_ws_memory_owned;

    #[test]
    fn pkalloc_zero_initializes_and_pkfree_clears_owned_storage() {
        let mut storage: Option<Box<[u8]>>;

        unsafe {
            storage = Some(pk_alloc(16).expect("pk_alloc of a small size succeeds"));
            assert_eq!(
                storage
                    .as_ref()
                    .expect("storage was just allocated as Some")
                    .len(),
                16
            );
            assert!(storage
                .as_ref()
                .expect("storage was just allocated as Some")
                .iter()
                .all(|&byte| byte == 0));

            assert_eq!(pk_free(&mut storage), Ok(()));
            assert!(storage.is_none());
        }
    }

    #[test]
    fn pkalloc_aligned_returns_aligned_zeroed_storage_and_pkfree_clears_it() {
        let mut allocation: Option<PkAlignedAllocation>;

        unsafe {
            allocation =
                Some(pk_alloc_aligned(33, 32).expect("aligned alloc of a small size succeeds"));
            let allocation_ref = allocation
                .as_ref()
                .expect("allocation was just allocated as Some");
            let ptr = allocation_ref
                .storage
                .as_ptr()
                .wrapping_add(allocation_ref.offset);
            assert_eq!((ptr as usize) % 32, 0);
            assert_eq!(allocation_ref.len, 33);
            assert!(
                allocation_ref.storage[allocation_ref.offset..allocation_ref.offset + 33]
                    .iter()
                    .all(|&byte| byte == 0)
            );

            assert_eq!(pk_free_aligned(&mut allocation), Ok(()));
            assert!(allocation.is_none());
        }
    }

    #[test]
    fn pkstrnicmp_matches_c_loop_and_raw_difference() {
        let same_case = b"AbCd\0";
        let other_case = b"aBcE\0";
        let shorter = b"abc\0";

        assert_eq!(pk_strnicmp(same_case, other_case, 3), 0);
        assert_eq!(
            pk_strnicmp(same_case, other_case, 4),
            b'd' as i32 - b'E' as i32
        );
        assert_eq!(pk_strnicmp(same_case, shorter, 10), b'd' as i32);
    }

    #[test]
    fn pkalloc_reports_out_of_memory_for_impossible_size() {
        unsafe {
            assert_eq!(pk_alloc(usize::MAX), Err(crate::WmpError::OutOfMemory));
        }
    }

    #[test]
    fn pk_codec_factory_create_format_converter_owned_sets_callbacks() {
        unsafe {
            let converter = pk_codec_factory_create_format_converter_owned();
            assert!(converter.Initialize.is_some());
            assert!(converter.InitializeConvert.is_some());
            assert!(converter.GetPixelFormat.is_some());
            assert!(converter.GetSourcePixelFormat.is_some());
            assert!(converter.GetSize.is_some());
            assert!(converter.GetResolution.is_some());
            assert!(converter.Copy.is_some());
            assert!(converter.Convert.is_some());

            drop(converter);
        }
    }

    #[test]
    fn pk_format_converter_getters_delegate_to_decoder_and_copy_then_convert() {
        PFC_COPY_CALLS.store(0, Ordering::SeqCst);
        PFC_CONVERT_CALLS.store(0, Ordering::SeqCst);

        let mut decoder = tagPKImageDecode {
            Initialize: None,
            GetPixelFormat: Some(|_pID, pPF| {
                let Some(pixel_format) = pPF else {
                    return Err(crate::WmpError::InvalidParameter);
                };
                *pixel_format = GUID_PKPixelFormat24bppRGB;
                Ok(())
            }),
            GetSize: Some(|_pID, piWidth, piHeight| {
                let Some(width) = piWidth else {
                    return Err(crate::WmpError::InvalidParameter);
                };
                let Some(height) = piHeight else {
                    return Err(crate::WmpError::InvalidParameter);
                };
                *width = 640;
                *height = 480;
                Ok(())
            }),
            GetResolution: Some(|_pID, pfrX, pfrY| {
                let Some(res_x) = pfrX else {
                    return Err(crate::WmpError::InvalidParameter);
                };
                let Some(res_y) = pfrY else {
                    return Err(crate::WmpError::InvalidParameter);
                };
                *res_x = 72.0;
                *res_y = 96.0;
                Ok(())
            }),
            GetColorContext: None,
            GetDescriptiveMetadata: None,
            GetRawStream: None,
            Copy: Some(|_pID, _pRect, pb, cbStride| {
                PFC_COPY_CALLS.fetch_add(1, Ordering::SeqCst);
                pb[0] = cbStride as u8;
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
            Convert: Some(|_pFC, _pRect, pb, _cbStride| {
                PFC_CONVERT_CALLS.fetch_add(1, Ordering::SeqCst);
                unsafe {
                    *pb = (*pb).wrapping_add(1);
                }
                Ok(())
            }),
            pDecoder: Some(NonNull::from(&mut decoder)),
            enPixelFormat: GUID_PKPixelFormat32bppBGRA,
        };
        let mut pixel_format = GUID_PKPixelFormatDontCare;
        let mut width = 0;
        let mut height = 0;
        let mut res_x = 0.0;
        let mut res_y = 0.0;
        let rect = tagPKRect {
            X: 0,
            Y: 0,
            Width: 1,
            Height: 1,
        };
        let mut bytes = [0_u8; 7];

        unsafe {
            assert_eq!(
                pk_format_converter_get_pixel_format(&mut converter, Some(&mut pixel_format)),
                Ok(())
            );
            assert!(is_equal_guid(&pixel_format, &GUID_PKPixelFormat32bppBGRA));

            assert_eq!(
                pk_format_converter_get_source_pixel_format(
                    &mut converter,
                    Some(&mut pixel_format)
                ),
                Ok(())
            );
            assert!(is_equal_guid(&pixel_format, &GUID_PKPixelFormat24bppRGB));

            assert_eq!(
                pk_format_converter_get_size(&mut converter, Some(&mut width), Some(&mut height)),
                Ok(())
            );
            assert_eq!((width, height), (640, 480));

            assert_eq!(
                pk_format_converter_get_resolution(
                    &mut converter,
                    Some(&mut res_x),
                    Some(&mut res_y),
                ),
                Ok(())
            );
            assert_eq!((res_x, res_y), (72.0, 96.0));

            assert_eq!(
                pk_format_converter_copy(&mut converter, Some(&rect), &mut bytes, 7,),
                Ok(())
            );
            assert_eq!(bytes[0], 8);
            assert_eq!(PFC_COPY_CALLS.load(Ordering::SeqCst), 1);
            assert_eq!(PFC_CONVERT_CALLS.load(Ordering::SeqCst), 1);

            assert_eq!(
                pk_format_converter_convert(&mut converter, &rect, bytes.as_mut_ptr(), 7),
                Ok(())
            );
        }
    }

    #[test]
    fn encode_glue_entry_points_reject_null_converter_or_rect() {
        let mut encoder = tagPKImageEncode::default();
        let mut converter = tagPKFormatConverter::default();
        let mut rect = tagPKRect::default();

        unsafe {
            assert_eq!(
                pk_image_encode_write_source(&mut encoder, std::ptr::null_mut(), &mut rect),
                Err(crate::WmpError::InvalidParameter)
            );
            assert_eq!(
                pk_image_encode_write_source(&mut encoder, &mut converter, std::ptr::null_mut()),
                Err(crate::WmpError::InvalidParameter)
            );
            assert_eq!(
                pk_image_encode_transcode(&mut encoder, std::ptr::null_mut(), &mut rect),
                Err(crate::WmpError::InvalidParameter)
            );
            assert_eq!(
                pk_image_encode_transcode(&mut encoder, &mut converter, std::ptr::null_mut()),
                Err(crate::WmpError::InvalidParameter)
            );
        }
    }

    #[test]
    fn pk_image_encode_create_sets_callbacks_and_base_methods_update_fields() {
        let mut backing = [0_u8; 8];
        let mut pixel = 0_u8;

        unsafe {
            let mut stream = create_ws_memory_owned(Some(&mut backing));
            let set_pos = stream.SetPos.expect("SetPos callback is present");
            assert_eq!(set_pos(&mut *stream, 5), Ok(()));

            let mut encoder = pk_image_encode_create_owned();
            assert!(encoder.Initialize.is_some());
            assert!(encoder.Terminate.is_some());
            assert!(encoder.SetPixelFormat.is_some());
            assert!(encoder.SetSize.is_some());
            assert!(encoder.SetResolution.is_some());
            assert!(encoder.SetColorContext.is_some());
            assert!(encoder.SetDescriptiveMetadata.is_some());
            assert!(encoder.WritePixels.is_some());
            assert!(encoder.WriteSource.is_none());
            assert!(encoder.WritePixelsBandedBegin.is_some());
            assert!(encoder.WritePixelsBanded.is_some());
            assert!(encoder.WritePixelsBandedEnd.is_some());
            assert!(encoder.Transcode.is_none());
            assert!(encoder.CreateNewFrame.is_some());
            assert!(!encoder.bWMP);

            let stream_ptr = NonNull::from(&mut *stream);
            let initialize = encoder.Initialize.expect("Initialize callback is present");
            assert_eq!(initialize(&mut *encoder, &mut *stream, None, 0), Ok(()));
            assert_eq!(encoder.pStream, Some(stream_ptr));
            assert_eq!(encoder.offStart, 5);
            assert!(is_equal_guid(
                &encoder.guidPixFormat,
                &GUID_PKPixelFormatDontCare
            ));
            assert_eq!(encoder.fResX, 96.0);
            assert_eq!(encoder.fResY, 96.0);
            assert_eq!(encoder.cFrame, 1);

            let set_pixel_format = encoder
                .SetPixelFormat
                .expect("SetPixelFormat callback is present");
            assert_eq!(
                set_pixel_format(&mut *encoder, GUID_PKPixelFormat24bppRGB),
                Ok(())
            );
            assert!(is_equal_guid(
                &encoder.guidPixFormat,
                &GUID_PKPixelFormat24bppRGB
            ));

            let set_size = encoder.SetSize.expect("SetSize callback is present");
            assert_eq!(
                set_size(&mut *encoder, -1, 240),
                Err(crate::WmpError::InvalidParameter)
            );
            assert_eq!(set_size(&mut *encoder, 320, 240), Ok(()));
            assert_eq!(encoder.uWidth, 320);
            assert_eq!(encoder.uHeight, 240);

            let set_resolution = encoder
                .SetResolution
                .expect("SetResolution callback is present");
            assert_eq!(set_resolution(&mut *encoder, 72.0, 144.0), Ok(()));
            assert_eq!(encoder.fResX, 72.0);
            assert_eq!(encoder.fResY, 144.0);

            let terminate = encoder.Terminate.expect("Terminate callback is present");
            assert_eq!(terminate(&mut *encoder), Ok(()));
            let set_color_context = encoder
                .SetColorContext
                .expect("SetColorContext callback is present");
            assert_eq!(
                set_color_context(&mut *encoder, Some(std::slice::from_ref(&pixel))),
                Err(crate::WmpError::NotYetImplemented)
            );
            let set_descriptive_metadata = encoder
                .SetDescriptiveMetadata
                .expect("SetDescriptiveMetadata callback is present");
            assert_eq!(
                set_descriptive_metadata(&mut *encoder, None),
                Err(crate::WmpError::NotYetImplemented)
            );
            let write_pixels = encoder
                .WritePixels
                .expect("WritePixels callback is present");
            assert_eq!(
                write_pixels(&mut *encoder, 1, std::slice::from_ref(&pixel), 1),
                Err(crate::WmpError::AbstractMethod)
            );
            let write_pixels_banded_begin = encoder
                .WritePixelsBandedBegin
                .expect("WritePixelsBandedBegin callback is present");
            assert_eq!(
                write_pixels_banded_begin(&mut *encoder, Some(&mut *stream)),
                Err(crate::WmpError::AbstractMethod)
            );
            let write_pixels_banded = encoder
                .WritePixelsBanded
                .expect("WritePixelsBanded callback is present");
            assert_eq!(
                write_pixels_banded(&mut *encoder, 1, &mut pixel, 1, 1),
                Err(crate::WmpError::AbstractMethod)
            );
            let write_pixels_banded_end = encoder
                .WritePixelsBandedEnd
                .expect("WritePixelsBandedEnd callback is present");
            assert_eq!(
                write_pixels_banded_end(&mut *encoder),
                Err(crate::WmpError::AbstractMethod)
            );
            let create_new_frame = encoder
                .CreateNewFrame
                .expect("CreateNewFrame callback is present");
            assert_eq!(create_new_frame(&mut *encoder), Ok(()));

            drop(encoder);
            drop(stream);
        }
    }

    #[test]
    fn pk_image_decode_create_sets_callbacks_and_accessors_return_base_fields() {
        let mut backing = [0_u8; 8];
        let mut pixel_format = GUID_PKPixelFormatDontCare;
        let mut width = 0;
        let mut height = 0;
        let mut res_x = 0.0;
        let mut res_y = 0.0;
        let mut frame_count = 0;

        unsafe {
            let mut stream = create_ws_memory_owned(Some(&mut backing));
            let set_pos = stream.SetPos.expect("SetPos callback is present");
            assert_eq!(set_pos(&mut *stream, 3), Ok(()));

            let mut decoder = pk_image_decode_create_owned();
            assert!(decoder.Initialize.is_some());
            assert!(decoder.GetPixelFormat.is_some());
            assert!(decoder.GetSize.is_some());
            assert!(decoder.GetResolution.is_some());
            assert!(decoder.GetColorContext.is_some());
            assert!(decoder.GetDescriptiveMetadata.is_some());
            assert!(decoder.Copy.is_some());
            assert!(decoder.GetFrameCount.is_some());
            assert!(decoder.SelectFrame.is_some());
            assert!(decoder.GetRawStream.is_none());

            decoder.uWidth = 320;
            decoder.uHeight = 240;
            decoder.WMP.wmiDEMisc.uImageOffset = 99;

            let stream_ptr = NonNull::from(&mut *stream);
            let initialize = decoder.Initialize.expect("Initialize callback is present");
            assert_eq!(initialize(&mut *decoder, &mut *stream), Ok(()));
            assert_eq!(decoder.pStream, Some(stream_ptr));
            assert_eq!(decoder.offStart, 3);
            assert_eq!(decoder.fResX, 96.0);
            assert_eq!(decoder.fResY, 96.0);
            assert_eq!(decoder.cFrame, 1);
            assert_eq!(decoder.WMP.wmiDEMisc.uImageOffset, 0);

            let get_pixel_format = decoder
                .GetPixelFormat
                .expect("GetPixelFormat callback is present");
            assert_eq!(
                get_pixel_format(&mut *decoder, Some(&mut pixel_format)),
                Ok(())
            );
            assert!(is_equal_guid(&pixel_format, &GUID_PKPixelFormatDontCare));

            let get_size = decoder.GetSize.expect("GetSize callback is present");
            assert_eq!(
                get_size(&mut *decoder, Some(&mut width), Some(&mut height)),
                Ok(())
            );
            assert_eq!((width, height), (320, 240));

            let get_resolution = decoder
                .GetResolution
                .expect("GetResolution callback is present");
            assert_eq!(
                get_resolution(&mut *decoder, Some(&mut res_x), Some(&mut res_y)),
                Ok(())
            );
            assert_eq!((res_x, res_y), (96.0, 96.0));

            let get_frame_count = decoder
                .GetFrameCount
                .expect("GetFrameCount callback is present");
            assert_eq!(
                get_frame_count(&mut *decoder, Some(&mut frame_count)),
                Ok(())
            );
            assert_eq!(frame_count, 1);

            let get_color_context = decoder
                .GetColorContext
                .expect("GetColorContext callback is present");
            assert_eq!(
                get_color_context(&mut *decoder, None, None),
                Err(crate::WmpError::NotYetImplemented)
            );
            let get_descriptive_metadata = decoder
                .GetDescriptiveMetadata
                .expect("GetDescriptiveMetadata callback is present");
            assert_eq!(
                get_descriptive_metadata(&mut *decoder, None),
                Err(crate::WmpError::NotYetImplemented)
            );
            let copy = decoder.Copy.expect("Copy callback is present");
            assert_eq!(
                copy(&mut *decoder, None, &mut [], 0),
                Err(crate::WmpError::AbstractMethod)
            );
            let select_frame = decoder
                .SelectFrame
                .expect("SelectFrame callback is present");
            assert_eq!(select_frame(&mut *decoder, 7), Ok(()));

            drop(decoder);
            drop(stream);
        }
    }

    #[test]
    fn iid_info_matches_known_extensions_by_prefix_case_insensitive() {
        let ext = OsStr::new("JXR-extra");
        let mut info: *const tagPKIIDInfo = std::ptr::null();

        unsafe {
            assert_eq!(get_iid_info(Some(ext), Some(&mut info)), Ok(()));
            assert!(!info.is_null());
            assert_eq!((*info).pIIDEnc, IID_PKImageWmpEncode);
            assert_eq!((*info).pIIDDec, IID_PKImageWmpDecode);
        }
    }

    #[test]
    fn image_iid_accessors_return_static_encode_and_decode_iids() {
        let wdp = OsStr::new("wdp");
        let hdp = OsStr::new("hdp");
        let mut iid: *const PkIid = std::ptr::null();

        unsafe {
            assert_eq!(get_image_encode_iid(Some(wdp), Some(&mut iid)), Ok(()));
            assert_eq!(*iid, IID_PKImageUnsupported);

            assert_eq!(get_image_decode_iid(Some(hdp), Some(&mut iid)), Ok(()));
            assert_eq!(*iid, IID_PKImageWmpDecode);
        }
    }

    #[test]
    fn iid_info_reports_unsupported_extension_and_clears_info() {
        let ext = OsStr::new("png");
        let mut info: *const tagPKIIDInfo = std::ptr::dangling();
        let mut iid: *const PkIid = std::ptr::dangling();

        unsafe {
            assert_eq!(
                get_iid_info(Some(ext), Some(&mut info)),
                Err(crate::WmpError::UnsupportedFormat)
            );
            assert!(info.is_null());
            assert_eq!(
                get_image_decode_iid(Some(ext), Some(&mut iid)),
                Err(crate::WmpError::UnsupportedFormat)
            );
        }
    }

    #[test]
    fn pixel_format_lookup_forward_replaces_guid_probe_with_table_entry() {
        let mut info = tagPKPixelInfo {
            pGUIDPixFmt: Some(GUID_PKPixelFormat24bppBGR),
            cChannel: 99,
            cfColorFormat: ColorFormat::YOnly,
            bdBitDepth: BitDepth::Eight,
            cbitUnit: 99,
            grBit: PixelFormatFlags(99),
            uInterpretation: PixelFormatInterpretation::WhiteIsZero,
            uSamplePerPixel: 99,
            uBitsPerSample: 99,
            uSampleFormat: 99,
        };

        unsafe {
            assert_eq!(pixel_format_lookup(&mut info, LOOKUP_FORWARD), Ok(()));
            assert_eq!(info.pGUIDPixFmt, Some(GUID_PKPixelFormat24bppBGR));
            assert_eq!(info.cChannel, 3);
            assert_eq!(info.cfColorFormat, ColorFormat::Rgb);
            assert_eq!(info.bdBitDepth, BitDepth::Eight);
            assert_eq!(info.cbitUnit, 24);
            assert_eq!(info.grBit, PixelFormatFlags::BGR);
            assert_eq!(info.uInterpretation, PixelFormatInterpretation::Rgb);
        }
    }

    #[test]
    fn pixel_format_lookup_backward_uses_tiff_fields_and_alpha_premul_bits() {
        let mut black_white = tagPKPixelInfo {
            pGUIDPixFmt: None,
            cChannel: 0,
            cfColorFormat: ColorFormat::YOnly,
            bdBitDepth: BitDepth::One,
            cbitUnit: 0,
            grBit: PixelFormatFlags::NONE,
            uInterpretation: PixelFormatInterpretation::WhiteIsZero,
            uSamplePerPixel: 1,
            uBitsPerSample: 1,
            uSampleFormat: 1,
        };
        let mut premul = tagPKPixelInfo {
            pGUIDPixFmt: None,
            cChannel: 0,
            cfColorFormat: ColorFormat::YOnly,
            bdBitDepth: BitDepth::One,
            cbitUnit: 0,
            grBit: PixelFormatFlags::HAS_ALPHA | PixelFormatFlags::PRE_MULTIPLIED,
            uInterpretation: PixelFormatInterpretation::Rgb,
            uSamplePerPixel: 4,
            uBitsPerSample: 8,
            uSampleFormat: 1,
        };

        unsafe {
            assert_eq!(
                pixel_format_lookup(&mut black_white, LOOKUP_BACKWARD_TIF),
                Ok(())
            );
            assert_eq!(black_white.pGUIDPixFmt, Some(GUID_PKPixelFormatBlackWhite));
            assert_eq!(
                black_white.uInterpretation,
                PixelFormatInterpretation::WhiteIsZero
            );

            assert_eq!(
                pixel_format_lookup(&mut premul, LOOKUP_BACKWARD_TIF),
                Ok(())
            );
            assert_eq!(premul.pGUIDPixFmt, Some(GUID_PKPixelFormat32bppPBGRA));
            assert_eq!(
                premul.grBit,
                PixelFormatFlags::HAS_ALPHA
                    | PixelFormatFlags::PRE_MULTIPLIED
                    | PixelFormatFlags::BGR
            );
        }
    }

    #[test]
    fn pixel_format_lookup_reports_unsupported_and_hash_scan_returns_first_match() {
        let mut unsupported = tagPKPixelInfo {
            pGUIDPixFmt: Some(GUID_PKPixelFormatDontCare),
            cChannel: 0,
            cfColorFormat: ColorFormat::YOnly,
            bdBitDepth: BitDepth::One,
            cbitUnit: 0,
            grBit: PixelFormatFlags::NONE,
            uInterpretation: PixelFormatInterpretation::WhiteIsZero,
            uSamplePerPixel: 77,
            uBitsPerSample: 77,
            uSampleFormat: 77,
        };

        unsafe {
            assert_eq!(
                pixel_format_lookup(&mut unsupported, LOOKUP_BACKWARD_TIF),
                Err(crate::WmpError::UnsupportedFormat)
            );
            assert!(is_equal_guid(
                get_pixel_format_from_hash(0x0d).expect("hash 0x0d maps to a known pixel format"),
                &GUID_PKPixelFormat24bppRGB
            ));
            assert!(is_equal_guid(
                get_pixel_format_from_hash(0x05).expect("hash 0x05 maps to a known pixel format"),
                &GUID_PKPixelFormatBlackWhite
            ));
            assert!(get_pixel_format_from_hash(0xfe).is_none());
        }
    }

    #[test]
    fn decoder_from_file_returns_err_for_truncated_jxr_inputs() {
        let cases: &[&[u8]] = &[
            b"",
            b"I",
            b"II",
            b"II\xbc",
            b"II\xbc\x01",
            b"II\xbc\x01\x08",
        ];

        for (idx, input) in cases.iter().enumerate() {
            let path = std::env::temp_dir().join(format!(
                "jpegxr-pure-rs-truncated-decoder-{}-{}.jxr",
                std::process::id(),
                idx
            ));
            std::fs::write(&path, input).expect("temporary truncated input should be written");

            unsafe {
                assert!(
                    pk_codec_factory_create_decoder_from_file(Some(path.as_path())).is_err(),
                    "truncated case {idx} unexpectedly decoded"
                );
            }

            let _ = std::fs::remove_file(path);
        }
    }
}
