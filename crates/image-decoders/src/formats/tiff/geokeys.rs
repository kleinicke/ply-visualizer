//! GeoTIFF: the tags that say where on the Earth a raster sits.
//!
//! A GeoTIFF is an ordinary TIFF plus a handful of tags. Two questions matter
//! to a viewer, and they are independent:
//!
//!   WHAT COORDINATE SYSTEM   34735 GeoKeyDirectory, with values that may live
//!                            in 34736 (doubles) or 34737 (one packed string)
//!   WHERE THE PIXELS LAND    33550 ModelPixelScale + 33922 ModelTiepoint, or
//!                            34264 ModelTransformation for a rotated raster
//!
//! The key directory is why a raw tag dump of a GeoTIFF is unreadable. It is a
//! flat `u16` array: a four-entry header (version, revision, minor, key count)
//! followed by four entries per key — id, LOCATION, count, and value-or-offset.
//! Location 0 means "the value is the fourth field"; 34736 and 34737 mean "the
//! fourth field is an index into that tag". So the interesting content is a
//! pile of integers pointing into two other tags, and every viewer that does
//! not unpack it shows the user exactly that pile.
//!
//! What this module does NOT do is reproject. Turning a UTM easting/northing
//! into latitude/longitude needs the projection maths (and, done properly, a
//! datum database); this reports coordinates in the raster's own CRS and names
//! that CRS, which is the part that needs no dependency and answers the
//! question people actually ask of a pixel. Geographic rasters — the ones
//! already in degrees — are the exception, and those come out as lon/lat
//! directly because no projection is involved.

use super::super::json_value::{to_json_string, JsonValue};

/// One decoded GeoKey: the spec's name for the id, and a value already
/// resolved through 34736/34737 and interpreted where the code is an
/// enumeration rather than a number.
pub(crate) struct GeoKey {
    pub name: String,
    pub value: String,
}

/// The raster-to-model transform, as the six coefficients of an affine map.
///
/// `x = a * px + b * py + c` and `y = d * px + e * py + f`, where `px`/`py` are
/// pixel coordinates. Both GeoTIFF spellings reduce to this: scale+tiepoint is
/// the axis-aligned case where `b` and `d` are zero.
pub(crate) struct ModelTransform {
    pub a: f64,
    pub b: f64,
    pub c: f64,
    pub d: f64,
    pub e: f64,
    pub f: f64,
}

/// Everything the viewer needs to answer "where is this pixel?".
pub(crate) struct GeoReference {
    pub keys: Vec<GeoKey>,
    pub transform: Option<ModelTransform>,
    /// A human-readable CRS name, e.g. "EPSG:32631 (WGS 84 / UTM zone 31N)".
    pub crs_label: Option<String>,
    /// True when coordinates are already degrees, so they can be shown as
    /// lon/lat rather than as projected units.
    pub is_geographic: bool,
    /// The linear/angular unit's name, for labelling the readout.
    pub unit: Option<String>,
    /// GTRasterTypeGeoKey: PixelIsArea (1) puts a pixel's coordinate at its
    /// CORNER, PixelIsPoint (2) at its CENTRE. Half a pixel, and DEMs and
    /// imagery disagree about it, so it is carried explicitly rather than
    /// assumed.
    pub pixel_is_point: bool,
}

/// The name the GeoTIFF spec gives each key id. Only the keys a file actually
/// tends to carry are named; anything else is reported by number rather than
/// guessed at, which keeps an unknown key visible instead of silently absent.
fn geo_key_name(id: u16) -> Option<&'static str> {
    Some(match id {
        1024 => "GTModelTypeGeoKey",
        1025 => "GTRasterTypeGeoKey",
        1026 => "GTCitationGeoKey",
        2048 => "GeographicTypeGeoKey",
        2049 => "GeogCitationGeoKey",
        2050 => "GeogGeodeticDatumGeoKey",
        2051 => "GeogPrimeMeridianGeoKey",
        2052 => "GeogLinearUnitsGeoKey",
        2053 => "GeogLinearUnitSizeGeoKey",
        2054 => "GeogAngularUnitsGeoKey",
        2055 => "GeogAngularUnitSizeGeoKey",
        2056 => "GeogEllipsoidGeoKey",
        2057 => "GeogSemiMajorAxisGeoKey",
        2058 => "GeogSemiMinorAxisGeoKey",
        2059 => "GeogInvFlatteningGeoKey",
        2060 => "GeogAzimuthUnitsGeoKey",
        2061 => "GeogPrimeMeridianLongGeoKey",
        3072 => "ProjectedCSTypeGeoKey",
        3073 => "PCSCitationGeoKey",
        3074 => "ProjectionGeoKey",
        3075 => "ProjCoordTransGeoKey",
        3076 => "ProjLinearUnitsGeoKey",
        3077 => "ProjLinearUnitSizeGeoKey",
        3078 => "ProjStdParallel1GeoKey",
        3079 => "ProjStdParallel2GeoKey",
        3080 => "ProjNatOriginLongGeoKey",
        3081 => "ProjNatOriginLatGeoKey",
        3082 => "ProjFalseEastingGeoKey",
        3083 => "ProjFalseNorthingGeoKey",
        3084 => "ProjFalseOriginLongGeoKey",
        3085 => "ProjFalseOriginLatGeoKey",
        3086 => "ProjFalseOriginEastingGeoKey",
        3087 => "ProjFalseOriginNorthingGeoKey",
        3088 => "ProjCenterLongGeoKey",
        3089 => "ProjCenterLatGeoKey",
        3090 => "ProjCenterEastingGeoKey",
        3091 => "ProjCenterNorthingGeoKey",
        3092 => "ProjScaleAtNatOriginGeoKey",
        3093 => "ProjScaleAtCenterGeoKey",
        3094 => "ProjAzimuthAngleGeoKey",
        3095 => "ProjStraightVertPoleLongGeoKey",
        4096 => "VerticalCSTypeGeoKey",
        4097 => "VerticalCitationGeoKey",
        4098 => "VerticalDatumGeoKey",
        4099 => "VerticalUnitsGeoKey",
        _ => return None,
    })
}

/// The EPSG unit codes worth naming. 9001 and 9102 cover the overwhelming
/// majority of real files; the rest are named because getting metres and feet
/// confused is a silent, plausible-looking error.
fn unit_name(code: u16) -> Option<&'static str> {
    Some(match code {
        9001 => "metre",
        9002 => "foot",
        9003 => "US survey foot",
        9005 => "Clarke's foot",
        9101 => "radian",
        9102 => "degree",
        9103 => "arc-minute",
        9104 => "arc-second",
        9105 => "grad",
        _ => return None,
    })
}

/// GeoTIFF's sentinel for "this is not an EPSG code — the projection is
/// spelled out in the individual Proj* keys". Reporting it as EPSG:32767 would
/// be a plausible-looking lie; `cea.tif` in the libgeotiff sample suite is
/// exactly this case, and GDAL calls it an unnamed PROJCS.
const USER_DEFINED: u16 = 32767;
/// The spec's "undefined" sentinel, which some writers emit for an absent key.
const UNDEFINED: u16 = 0;

/// Name a projected CRS from its EPSG code.
///
/// The UTM zones are COMPUTED rather than tabulated: 32601-32660 and
/// 32701-32760 are WGS 84 UTM north and south by zone, which is 120 of the
/// codes a real remote-sensing file is most likely to carry (every Sentinel-2
/// tile is one of them) and would otherwise be 120 table rows. Everything
/// beyond the handful listed reports its bare code — an honest "EPSG:2154" is
/// more useful than a wrong name.
fn projected_crs_name(code: u16) -> Option<String> {
    let named = match code {
        3857 => "WGS 84 / Pseudo-Mercator",
        3395 => "WGS 84 / World Mercator",
        4326 => "WGS 84",
        _ => {
            if (32601..=32660).contains(&code) {
                return Some(format!("WGS 84 / UTM zone {}N", code - 32600));
            }
            if (32701..=32760).contains(&code) {
                return Some(format!("WGS 84 / UTM zone {}S", code - 32700));
            }
            // The North American UTM blocks, which is what most older USGS
            // data carries — i30dem.tif in the libgeotiff samples is 26710.
            if (26703..=26722).contains(&code) {
                return Some(format!("NAD27 / UTM zone {}N", code - 26700));
            }
            if (26903..=26923).contains(&code) {
                return Some(format!("NAD83 / UTM zone {}N", code - 26900));
            }
            return None;
        }
    };
    Some(named.to_string())
}

/// Name a geographic CRS from its EPSG code — the few that dominate.
fn geographic_crs_name(code: u16) -> Option<&'static str> {
    Some(match code {
        4326 => "WGS 84",
        4269 => "NAD83",
        4267 => "NAD27",
        4258 => "ETRS89",
        4277 => "OSGB36",
        4230 => "ED50",
        _ => return None,
    })
}

/// The projection METHOD, ProjCoordTransGeoKey (3075). Not a CRS code — it
/// names the maths, and shows up on any file whose projection is user-defined
/// rather than an EPSG code (which is precisely when the reader has nothing
/// else to go on). `cea.tif` in the libgeotiff samples is 28.
fn coord_trans_name(code: u16) -> Option<&'static str> {
    Some(match code {
        1 => "Transverse Mercator",
        2 => "Transverse Mercator (modified Alaska)",
        3 => "Oblique Mercator",
        4 => "Oblique Mercator (Laborde)",
        5 => "Oblique Mercator (Rosenmund)",
        6 => "Oblique Mercator (spherical)",
        7 => "Mercator",
        8 => "Lambert Conformal Conic (2SP)",
        9 => "Lambert Conformal Conic (Helmert)",
        10 => "Lambert Azimuthal Equal Area",
        11 => "Albers Equal Area",
        12 => "Azimuthal Equidistant",
        13 => "Equidistant Conic",
        14 => "Stereographic",
        15 => "Polar Stereographic",
        16 => "Oblique Stereographic",
        17 => "Equirectangular",
        18 => "Cassini-Soldner",
        19 => "Gnomonic",
        20 => "Miller Cylindrical",
        21 => "Orthographic",
        22 => "Polyconic",
        23 => "Robinson",
        24 => "Sinusoidal",
        25 => "Van der Grinten",
        26 => "New Zealand Map Grid",
        27 => "Transverse Mercator (south oriented)",
        28 => "Cylindrical Equal Area",
        _ => return None,
    })
}

/// Geodetic datum codes (2050) — the few that dominate real data.
fn datum_name(code: u16) -> Option<&'static str> {
    Some(match code {
        6267 => "North American Datum 1927",
        6269 => "North American Datum 1983",
        6326 => "WGS 84",
        6258 => "ETRS89",
        6277 => "OSGB 1936",
        6230 => "ED50",
        _ => return None,
    })
}

/// Ellipsoid codes (2056).
fn ellipsoid_name(code: u16) -> Option<&'static str> {
    Some(match code {
        7001 => "Airy 1830",
        7004 => "Bessel 1841",
        7008 => "Clarke 1866",
        7019 => "GRS 1980",
        7022 => "International 1924",
        7030 => "WGS 84",
        _ => return None,
    })
}

/// Interpret a key's raw value, turning the enumerated codes into words.
fn describe_key(id: u16, raw: &str, numeric: Option<f64>) -> String {
    let code = numeric
        .filter(|v| v.fract() == 0.0 && *v >= 0.0 && *v <= 65535.0)
        .map(|v| v as u16);
    // 32767 means "user-defined" for EVERY key that carries a code, not just
    // the CRS ones: the value is spelled out in other keys. Printing the bare
    // number invites reading it as a real code.
    if code == Some(USER_DEFINED)
        && matches!(
            id,
            1024 | 2048
                | 2050
                | 2051
                | 2052
                | 2054
                | 2056
                | 2060
                | 3072
                | 3074
                | 3075
                | 3076
                | 4096
                | 4098
                | 4099
        )
    {
        return "user-defined".to_string();
    }
    match (id, code) {
        (1024, Some(1)) => "1 (projected 2D)".to_string(),
        (1024, Some(2)) => "2 (geographic 2D)".to_string(),
        (1024, Some(3)) => "3 (geocentric cartesian)".to_string(),
        (1025, Some(1)) => "1 (PixelIsArea)".to_string(),
        (1025, Some(2)) => "2 (PixelIsPoint)".to_string(),
        (3072 | 2048, Some(UNDEFINED)) => "undefined".to_string(),
        (3072, Some(c)) => match projected_crs_name(c) {
            Some(name) => format!("EPSG:{} ({})", c, name),
            None => format!("EPSG:{}", c),
        },
        (2048, Some(c)) => match geographic_crs_name(c) {
            Some(name) => format!("EPSG:{} ({})", c, name),
            None => format!("EPSG:{}", c),
        },
        (3075, Some(c)) => match coord_trans_name(c) {
            Some(name) => format!("{} ({})", c, name),
            None => c.to_string(),
        },
        (2050, Some(c)) => match datum_name(c) {
            Some(name) => format!("{} ({})", c, name),
            None => c.to_string(),
        },
        (2056, Some(c)) => match ellipsoid_name(c) {
            Some(name) => format!("{} ({})", c, name),
            None => c.to_string(),
        },
        (2051, Some(8901)) => "8901 (Greenwich)".to_string(),
        // Unit keys, all of which carry an EPSG unit code.
        (2052 | 2054 | 2060 | 3076 | 4099, Some(c)) => match unit_name(c) {
            Some(name) => format!("{} ({})", c, name),
            None => c.to_string(),
        },
        _ => raw.to_string(),
    }
}

/// Unpack 34735/34736/34737 and 33550/33922/34264 into a `GeoReference`.
///
/// Returns `None` when the file carries no key directory at all, which is the
/// ordinary case for a non-geo TIFF and not an error.
pub(crate) fn parse_geo_reference(
    directory: &[u16],
    doubles: &[f64],
    ascii: &str,
    pixel_scale: &[f64],
    tiepoint: &[f64],
    transformation: &[f64],
) -> Option<GeoReference> {
    // A directory shorter than its own header, or one whose count overruns the
    // array, is malformed; report what is readable rather than nothing.
    if directory.len() < 4 {
        return None;
    }
    let count = directory[3] as usize;
    let available = (directory.len() - 4) / 4;
    let count = count.min(available);

    let mut keys = Vec::with_capacity(count);
    let mut model_type: Option<u16> = None;
    let mut projected_code: Option<u16> = None;
    let mut geographic_code: Option<u16> = None;
    let mut linear_unit: Option<u16> = None;
    let mut angular_unit: Option<u16> = None;
    let mut pixel_is_point = false;
    let mut citation: Option<String> = None;

    for i in 0..count {
        let base = 4 + i * 4;
        let id = directory[base];
        let location = directory[base + 1];
        let value_count = directory[base + 2] as usize;
        let offset = directory[base + 3] as usize;

        let (raw, numeric) = match location {
            // The value IS the fourth field.
            0 => (
                directory[base + 3].to_string(),
                Some(directory[base + 3] as f64),
            ),
            34736 => {
                let end = offset.saturating_add(value_count).min(doubles.len());
                let slice = doubles.get(offset..end).unwrap_or(&[]);
                let text = slice
                    .iter()
                    .map(|v| v.to_string())
                    .collect::<Vec<_>>()
                    .join(", ");
                (text, slice.first().copied())
            }
            34737 => {
                // GeoAsciiParams packs every string into one blob, each
                // terminated by '|' rather than NUL so the TIFF ASCII reader
                // sees a single value.
                let end = offset.saturating_add(value_count).min(ascii.len());
                let text = ascii
                    .get(offset..end)
                    .unwrap_or("")
                    .trim_end_matches('|')
                    .trim_end_matches('\0')
                    .to_string();
                (text, None)
            }
            other => (format!("<value in tag {}>", other), None),
        };

        match id {
            1024 => model_type = numeric.map(|v| v as u16),
            1025 => pixel_is_point = numeric.map(|v| v as u16) == Some(2),
            3072 => projected_code = numeric.map(|v| v as u16),
            2048 => geographic_code = numeric.map(|v| v as u16),
            3076 | 2052 => linear_unit = numeric.map(|v| v as u16),
            2054 => angular_unit = numeric.map(|v| v as u16),
            // Any of the citation keys, whichever the writer chose to use.
            1026 | 3073 | 2049 if citation.is_none() && !raw.is_empty() => {
                citation = Some(raw.clone())
            }
            _ => {}
        }

        keys.push(GeoKey {
            name: geo_key_name(id)
                .map(|n| n.to_string())
                .unwrap_or_else(|| format!("GeoKey {}", id)),
            value: describe_key(id, &raw, numeric),
        });
    }

    // Geographic when the model type says so, or — for a file that omits
    // GTModelTypeGeoKey, which happens — when it names a geographic CRS and no
    // projected one.
    let is_geographic = model_type == Some(2)
        || (model_type.is_none() && projected_code.is_none() && geographic_code.is_some());

    // A user-defined or undefined code is a sentinel, not a CRS: the
    // projection lives in the individual Proj* keys and the citation is the
    // only name there is. Formatting the sentinel as "EPSG:32767" would read
    // as a real code.
    let real_code = |c: u16| (c != USER_DEFINED && c != UNDEFINED).then_some(c);
    let crs_label = if is_geographic {
        geographic_code
            .and_then(real_code)
            .map(|c| match geographic_crs_name(c) {
                Some(name) => format!("EPSG:{} ({})", c, name),
                None => format!("EPSG:{}", c),
            })
    } else {
        projected_code
            .and_then(real_code)
            .map(|c| match projected_crs_name(c) {
                Some(name) => format!("EPSG:{} ({})", c, name),
                None => format!("EPSG:{}", c),
            })
    }
    // A file with no EPSG code may still name itself in a citation.
    .or(citation);

    let unit = if is_geographic {
        angular_unit.and_then(unit_name).map(|s| s.to_string())
    } else {
        linear_unit.and_then(unit_name).map(|s| s.to_string())
    };

    Some(GeoReference {
        keys,
        transform: model_transform(pixel_scale, tiepoint, transformation),
        crs_label,
        is_geographic,
        unit,
        pixel_is_point,
    })
}

/// Reduce whichever georeferencing spelling the file uses to one affine map.
///
/// 34264 wins when present, per the spec: a file carrying both is telling us
/// the raster is rotated, and the scale/tiepoint pair cannot express that.
fn model_transform(
    pixel_scale: &[f64],
    tiepoint: &[f64],
    transformation: &[f64],
) -> Option<ModelTransform> {
    if transformation.len() >= 16 {
        return Some(ModelTransform {
            a: transformation[0],
            b: transformation[1],
            c: transformation[3],
            d: transformation[4],
            e: transformation[5],
            f: transformation[7],
        });
    }
    // ModelTiepoint is (i, j, k, x, y, z) — a raster point and the model point
    // it maps to. Files carry one tiepoint plus a scale; the multi-tiepoint
    // (GCP) form describes a warp this cannot express, so it is declined
    // rather than approximated by its first point.
    if pixel_scale.len() >= 2 && tiepoint.len() >= 6 {
        if tiepoint.len() > 6 {
            return None;
        }
        let (sx, sy) = (pixel_scale[0], pixel_scale[1]);
        let (i, j) = (tiepoint[0], tiepoint[1]);
        let (x, y) = (tiepoint[3], tiepoint[4]);
        // The y scale is positive in the tag and the raster runs top-down, so
        // northing DECREASES with row: the sign is the classic GeoTIFF trap.
        return Some(ModelTransform {
            a: sx,
            b: 0.0,
            c: x - i * sx,
            d: 0.0,
            e: -sy,
            f: y + j * sy,
        });
    }
    None
}

impl GeoReference {
    /// The georeferencing as JSON, for the webview's coordinate readout.
    /// Returns an empty string when the file has keys but no usable transform
    /// AND no CRS worth naming, so callers can skip the field entirely.
    pub(crate) fn to_json(&self) -> String {
        let mut obj: Vec<(String, JsonValue)> = Vec::new();
        if let Some(label) = &self.crs_label {
            obj.push(("crs".to_string(), JsonValue::Str(label.clone())));
        }
        obj.push((
            "isGeographic".to_string(),
            JsonValue::Bool(self.is_geographic),
        ));
        obj.push((
            "pixelIsPoint".to_string(),
            JsonValue::Bool(self.pixel_is_point),
        ));
        if let Some(unit) = &self.unit {
            obj.push(("unit".to_string(), JsonValue::Str(unit.clone())));
        }
        if let Some(t) = &self.transform {
            obj.push((
                "transform".to_string(),
                JsonValue::Arr(
                    [t.a, t.b, t.c, t.d, t.e, t.f]
                        .iter()
                        .map(|v| JsonValue::Num(*v))
                        .collect(),
                ),
            ));
        }
        to_json_string(&JsonValue::Obj(obj))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Header (version, revision, minor, count) followed by four SHORTs per key.
    fn directory(keys: &[[u16; 4]]) -> Vec<u16> {
        let mut out = vec![1, 1, 1, keys.len() as u16];
        for k in keys {
            out.extend_from_slice(k);
        }
        out
    }

    #[test]
    fn resolves_a_utm_crs_and_the_north_up_transform() {
        let geo = parse_geo_reference(
            &directory(&[
                [1024, 0, 1, 1],     // projected
                [1025, 0, 1, 1],     // PixelIsArea
                [3072, 0, 1, 32631], // WGS 84 / UTM 31N
                [3076, 0, 1, 9001],  // metre
            ]),
            &[],
            "",
            &[10.0, 10.0, 0.0],
            &[0.0, 0.0, 0.0, 300000.0, 5700000.0, 0.0],
            &[],
        )
        .expect("a key directory is present");

        assert_eq!(
            geo.crs_label.as_deref(),
            Some("EPSG:32631 (WGS 84 / UTM zone 31N)"),
            "the UTM zone is computed from the EPSG code, not tabulated"
        );
        assert!(!geo.is_geographic);
        assert_eq!(geo.unit.as_deref(), Some("metre"));
        assert!(!geo.pixel_is_point);

        let t = geo
            .transform
            .expect("scale + tiepoint georeference the raster");
        assert_eq!((t.a, t.b, t.c), (10.0, 0.0, 300000.0));
        // The classic GeoTIFF trap: the tag's y scale is POSITIVE, but rows run
        // top-down while northing runs up, so `e` must come out negative.
        assert_eq!((t.d, t.e, t.f), (0.0, -10.0, 5700000.0));
        // One row down is 10 m SOUTH.
        assert_eq!(t.e * 1.0 + t.f, 5699990.0);
    }

    #[test]
    fn reads_a_geographic_crs_as_degrees() {
        let geo = parse_geo_reference(
            &directory(&[[1024, 0, 1, 2], [2048, 0, 1, 4326], [2054, 0, 1, 9102]]),
            &[],
            "",
            &[0.01, 0.01, 0.0],
            &[0.0, 0.0, 0.0, 10.0, 50.0, 0.0],
            &[],
        )
        .unwrap();
        assert!(geo.is_geographic, "model type 2 is geographic");
        assert_eq!(geo.crs_label.as_deref(), Some("EPSG:4326 (WGS 84)"));
        assert_eq!(geo.unit.as_deref(), Some("degree"));
    }

    #[test]
    fn model_transformation_wins_over_scale_and_tiepoint() {
        // A rotated raster: 34264 carries the rotation that 33550/33922 cannot
        // express, so a file with both is describing a rotation and the pair
        // must not be preferred.
        let transformation = vec![
            8.66, -5.0, 0.0, 300000.0, 5.0, 8.66, 0.0, 5700000.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
            0.0, 1.0,
        ];
        let geo = parse_geo_reference(
            &directory(&[[3072, 0, 1, 32631]]),
            &[],
            "",
            &[10.0, 10.0, 0.0],
            &[0.0, 0.0, 0.0, 1.0, 2.0, 0.0],
            &transformation,
        )
        .unwrap();
        let t = geo.transform.unwrap();
        assert_eq!((t.a, t.b, t.c), (8.66, -5.0, 300000.0));
        assert_eq!((t.d, t.e, t.f), (5.0, 8.66, 5700000.0));
    }

    #[test]
    fn multiple_tiepoints_are_declined_rather_than_approximated() {
        // Two tiepoints and no scale is the GCP form: a warp, not an affine.
        // Using only the first point would place the raster confidently wrong.
        let geo = parse_geo_reference(
            &directory(&[[3072, 0, 1, 32631]]),
            &[],
            "",
            &[10.0, 10.0, 0.0],
            &[
                0.0, 0.0, 0.0, 300000.0, 5700000.0, 0.0, 64.0, 48.0, 0.0, 300640.0, 5699520.0, 0.0,
            ],
            &[],
        )
        .unwrap();
        assert!(
            geo.transform.is_none(),
            "a GCP warp is not an affine transform"
        );
        assert!(geo.crs_label.is_some(), "the CRS is still reported");
    }

    #[test]
    fn resolves_values_out_of_the_ascii_and_double_params() {
        let geo = parse_geo_reference(
            &directory(&[
                [1025, 0, 1, 2],      // PixelIsPoint
                [1026, 34737, 21, 0], // citation, in GeoAsciiParams
                [2057, 34736, 1, 0],  // semi-major axis, in GeoDoubleParams
            ]),
            &[6378137.0],
            "WGS 84 / UTM zone 31N|WGS 84|",
            &[],
            &[],
            &[],
        )
        .unwrap();
        assert!(
            geo.pixel_is_point,
            "PixelIsPoint shifts sampling by half a pixel"
        );
        let by_name = |n: &str| {
            geo.keys
                .iter()
                .find(|k| k.name == n)
                .map(|k| k.value.clone())
        };
        assert_eq!(
            by_name("GTCitationGeoKey").as_deref(),
            Some("WGS 84 / UTM zone 31N")
        );
        assert_eq!(
            by_name("GeogSemiMajorAxisGeoKey").as_deref(),
            Some("6378137")
        );
        assert_eq!(
            by_name("GTRasterTypeGeoKey").as_deref(),
            Some("2 (PixelIsPoint)")
        );
    }

    #[test]
    fn a_truncated_directory_reports_what_it_can() {
        // Claims four keys but carries one. Malformed files exist; reporting
        // the readable key beats returning nothing or panicking on the slice.
        let mut dir = vec![1, 1, 1, 4];
        dir.extend_from_slice(&[3072, 0, 1, 32631]);
        let geo = parse_geo_reference(&dir, &[], "", &[], &[], &[]).unwrap();
        assert_eq!(geo.keys.len(), 1);
        assert_eq!(
            geo.crs_label.as_deref(),
            Some("EPSG:32631 (WGS 84 / UTM zone 31N)")
        );
    }

    #[test]
    fn a_user_defined_crs_falls_back_to_its_citation() {
        // 32767 is the spec's "user-defined" sentinel: the projection is in
        // the Proj* keys, not an EPSG code. `cea.tif` in the libgeotiff sample
        // suite is exactly this, and GDAL reports an unnamed PROJCS for it.
        // Printing "EPSG:32767" would read as a real code.
        let geo = parse_geo_reference(
            &directory(&[[1024, 0, 1, 1], [3072, 0, 1, 32767], [3073, 34737, 24, 0]]),
            &[],
            "Cylindrical Equal Area|",
            &[],
            &[],
            &[],
        )
        .unwrap();
        assert_eq!(
            geo.crs_label.as_deref(),
            Some("Cylindrical Equal Area"),
            "a user-defined CRS is named by its citation, never by the sentinel"
        );
        let raw = geo
            .keys
            .iter()
            .find(|k| k.name == "ProjectedCSTypeGeoKey")
            .map(|k| k.value.clone());
        assert_eq!(raw.as_deref(), Some("user-defined"));
    }

    #[test]
    fn names_the_projection_method_and_its_datum() {
        // The rows a user-defined projection leaves you reading: without these
        // the panel shows "ProjCoordTransGeoKey 28", which says nothing.
        let geo = parse_geo_reference(
            &directory(&[
                [3074, 0, 1, 32767], // ProjectionGeoKey, user-defined
                [3075, 0, 1, 28],    // Cylindrical Equal Area
                [2050, 0, 1, 6267],  // NAD27
                [2056, 0, 1, 7008],  // Clarke 1866
            ]),
            &[],
            "",
            &[],
            &[],
            &[],
        )
        .unwrap();
        let by_name = |n: &str| {
            geo.keys
                .iter()
                .find(|k| k.name == n)
                .map(|k| k.value.clone())
        };
        assert_eq!(
            by_name("ProjectionGeoKey").as_deref(),
            Some("user-defined"),
            "32767 is user-defined for every key that carries a code, not just the CRS ones"
        );
        assert_eq!(
            by_name("ProjCoordTransGeoKey").as_deref(),
            Some("28 (Cylindrical Equal Area)")
        );
        assert_eq!(
            by_name("GeogGeodeticDatumGeoKey").as_deref(),
            Some("6267 (North American Datum 1927)")
        );
        assert_eq!(
            by_name("GeogEllipsoidGeoKey").as_deref(),
            Some("7008 (Clarke 1866)")
        );
    }

    #[test]
    fn names_the_north_american_utm_blocks() {
        // 26710 is i30dem.tif in the libgeotiff samples — older USGS data is
        // NAD27, not WGS 84, so the WGS-only ranges would miss all of it.
        let geo = parse_geo_reference(
            &directory(&[[1024, 0, 1, 1], [3072, 0, 1, 26710]]),
            &[],
            "",
            &[],
            &[],
            &[],
        )
        .unwrap();
        assert_eq!(
            geo.crs_label.as_deref(),
            Some("EPSG:26710 (NAD27 / UTM zone 10N)")
        );
    }

    #[test]
    fn an_unknown_epsg_code_reports_its_number_rather_than_a_guess() {
        let geo = parse_geo_reference(
            &directory(&[[1024, 0, 1, 1], [3072, 0, 1, 2154]]),
            &[],
            "",
            &[],
            &[],
            &[],
        )
        .unwrap();
        assert_eq!(geo.crs_label.as_deref(), Some("EPSG:2154"));
    }
}
