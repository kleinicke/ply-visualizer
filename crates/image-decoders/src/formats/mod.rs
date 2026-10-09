pub(crate) mod compression;
#[cfg(feature = "czi")]
pub(crate) mod czi;
#[cfg(feature = "dicom")]
pub(crate) mod dicom;
#[cfg(feature = "exr")]
pub(crate) mod exr;
#[cfg(feature = "fits")]
pub(crate) mod fits;
#[cfg(feature = "hdr")]
pub(crate) mod hdr;
// Needed by both the TIFF strip decoders and the microscopy formats, with no
// feature implying both; ungated so there is exactly one implementation.
pub(crate) mod external_codec;
pub(crate) mod half;
#[cfg(feature = "jpeg2000")]
pub(crate) mod jpeg2000;
#[cfg(feature = "jpegxr")]
pub(crate) mod jpegxr;
#[cfg(any(
    feature = "tiff",
    feature = "npy",
    feature = "jpeg2000",
    feature = "jpegxr",
    feature = "jxl",
    feature = "fits",
    feature = "netcdf",
    feature = "dicom",
    feature = "czi",
    feature = "nd2",
    feature = "lif",
    feature = "sdt"
))]
pub(crate) mod json_value;
#[cfg(feature = "jxl")]
pub(crate) mod jxl;
#[cfg(feature = "lif")]
pub(crate) mod lif;
#[cfg(any(
    feature = "tiff",
    feature = "exr",
    feature = "hdr",
    feature = "jpeg2000",
    feature = "jpegxr",
    feature = "jxl",
    feature = "npy",
    feature = "fits",
    feature = "netcdf",
    feature = "dicom",
    feature = "czi",
    feature = "nd2",
    feature = "lif",
    feature = "sdt"
))]
pub(crate) mod metadata;
#[cfg(feature = "nd2")]
pub(crate) mod nd2;
#[cfg(feature = "netcdf")]
pub(crate) mod netcdf;
#[cfg(feature = "netpbm")]
pub(crate) mod netpbm;
#[cfg(feature = "npy")]
pub(crate) mod npy;
#[cfg(feature = "pfm")]
pub(crate) mod pfm;
#[cfg(feature = "png")]
pub(crate) mod png;
#[cfg(feature = "psd")]
pub(crate) mod psd;
#[cfg(any(
    feature = "jpeg2000",
    feature = "jpegxr",
    feature = "jxl",
    feature = "fits",
    feature = "netcdf",
    feature = "dicom",
    feature = "czi",
    feature = "nd2",
    feature = "lif",
    feature = "sdt"
))]
pub(crate) mod scientific_common;
#[cfg(feature = "sdt")]
pub(crate) mod sdt;
#[cfg(feature = "tiff")]
pub(crate) mod tiff;

#[cfg(feature = "sgi")]
pub(crate) mod sgi;
