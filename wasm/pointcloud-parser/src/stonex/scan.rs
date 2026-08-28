//! X3R scan-record decoding: ranges and pulse widths to points.
//!
//! An X3R member is a descriptor followed by `XCOL` blocks, one per azimuth
//! step. Each block carries its own azimuth and an organised column of
//! range/pulse-width pairs sampled by the vertically sweeping mirror, so a
//! point's direction comes from the block's azimuth and the sample's row rather
//! than from anything stored per point. That is why there are no coordinates in
//! the file at all — only distances.

/// `XCOL`, the per-column block marker.
const COLUMN_MAGIC: &[u8; 4] = b"XCOL";
/// `003X`, the record marker.
pub const RECORD_MAGIC: &[u8; 4] = b"003X";
/// Where the first column block sits in firmware v14.
const COLUMN_OFFSET: usize = 16_408;
const COLUMN_HEADER_BYTES: usize = 48;
/// Ranges are stored as tenths of a millimetre.
const RANGE_SCALE_METRES: f64 = 1e-4;
const PULSE_WIDTH_MAX: f64 = 16_383.0;
/// Anything at or above this is the "no return" sentinel.
const INVALID_RANGE_MAX: i32 = 0x7fff_ffff;
/// The mirror sweeps from 65 degrees above the horizon down to 25 below.
const VERTICAL_MIN_DEGREES: f64 = -25.0;
const VERTICAL_SPAN_DEGREES: f64 = 90.0;

pub struct ScanLayout {
    pub columns: usize,
    pub rows: usize,
    pub column_offset: usize,
    pub column_stride: usize,
    /// Samples that carry a real return, i.e. the point count.
    pub valid_points: usize,
}

pub struct ScanPoints {
    /// Interleaved xyz in viewer axes: x = model Y, y = model X, z = model Z.
    pub positions: Vec<f32>,
    /// Pulse width normalised to 0..1.
    pub intensity: Vec<f32>,
    /// Each column's azimuth in degrees, and how many points it produced.
    ///
    /// Carried out of the decode because the colour pass selects candidates by
    /// column: a scan is organised by azimuth, so a whole column either faces a
    /// frame or does not, and re-deriving that per point afterwards would undo
    /// the saving.
    pub column_azimuths: Vec<f64>,
    pub points_per_column: Vec<u32>,
}

fn read_u32(data: &[u8], offset: usize) -> Option<u32> {
    data.get(offset..offset + 4)
        .map(|bytes| u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}

fn read_i32(data: &[u8], offset: usize) -> Option<i32> {
    read_u32(data, offset).map(|value| value as i32)
}

/// Locates the first column block within a record.
///
/// The expected offset is checked first and a bounded scan follows, which keeps
/// the decoder useful across nearby firmware layouts without letting a
/// malformed file turn into an unbounded search.
fn find_column_offset(record: &[u8]) -> Option<usize> {
    if record.get(COLUMN_OFFSET..COLUMN_OFFSET + 4) == Some(COLUMN_MAGIC.as_slice()) {
        return Some(COLUMN_OFFSET);
    }
    let end = record.len().min(1024 * 1024);
    let mut offset = 16;
    while offset + 4 <= end {
        if record.get(offset..offset + 4) == Some(COLUMN_MAGIC.as_slice()) {
            return Some(offset);
        }
        offset += 4;
    }
    None
}

/// Reads a record's geometry and counts its real returns.
///
/// Counting first means the output arrays are allocated once at their exact
/// size: an organised grid is mostly empty sky and missed returns, so sizing to
/// the grid would hold several times the memory the points need.
pub fn read_layout(record: &[u8]) -> Result<ScanLayout, String> {
    if record.len() < 64
        || record.get(0..4) != Some(RECORD_MAGIC.as_slice())
        || record.get(8..12) != Some(b"DESC".as_slice())
    {
        return Err("unsupported X3R header".to_string());
    }
    let columns = read_u32(record, 32).ok_or("truncated X3R header")? as usize;
    let rows = read_u32(record, 44).ok_or("truncated X3R header")? as usize;
    if columns == 0 || rows == 0 || columns > 100_000 || rows > 100_000 {
        return Err(format!("invalid scan dimensions {columns} x {rows}"));
    }

    let column_offset = find_column_offset(record).ok_or("no XCOL scan data")?;
    let column_stride = COLUMN_HEADER_BYTES + rows * 8;
    if column_offset + columns * column_stride > record.len() {
        return Err("truncated XCOL data".to_string());
    }

    let mut valid_points = 0usize;
    for column in 0..columns {
        let block = column_offset + column * column_stride;
        if record.get(block..block + 4) != Some(COLUMN_MAGIC.as_slice()) {
            return Err(format!("invalid column {column}"));
        }
        let mut sample = block + COLUMN_HEADER_BYTES;
        for _ in 0..rows {
            let raw = read_i32(record, sample).unwrap_or(0);
            if raw > 0 && raw < INVALID_RANGE_MAX {
                valid_points += 1;
            }
            sample += 8;
        }
    }

    Ok(ScanLayout {
        columns,
        rows,
        column_offset,
        column_stride,
        valid_points,
    })
}

/// Turns a record's ranges into points.
///
/// Elevation is derived from the row index: the sweep runs from its upper limit
/// downwards, so low rows see sky and high rows the ground. The per-row sine and
/// cosine are computed once per record rather than per sample, which matters at
/// tens of millions of points.
pub fn decode_points(record: &[u8], layout: &ScanLayout) -> ScanPoints {
    let mut positions = Vec::with_capacity(layout.valid_points * 3);
    let mut intensity = Vec::with_capacity(layout.valid_points);
    let mut column_azimuths = Vec::with_capacity(layout.columns);
    let mut points_per_column = Vec::with_capacity(layout.columns);

    let vertical_step = VERTICAL_SPAN_DEGREES / layout.rows as f64;
    let vertical_max = VERTICAL_MIN_DEGREES + VERTICAL_SPAN_DEGREES;
    let mut vertical_sin = vec![0.0f64; layout.rows];
    let mut vertical_cos = vec![0.0f64; layout.rows];
    for row in 0..layout.rows {
        let elevation = (vertical_max - row as f64 * vertical_step).to_radians();
        vertical_sin[row] = elevation.sin();
        vertical_cos[row] = elevation.cos();
    }

    for column in 0..layout.columns {
        let block = layout.column_offset + column * layout.column_stride;
        let azimuth_degrees = read_i32(record, block + 20).unwrap_or(0) as f64 * 1e-6;
        column_azimuths.push(azimuth_degrees);
        let before = intensity.len();
        let azimuth = azimuth_degrees.to_radians();
        let (sin_azimuth, cos_azimuth) = (azimuth.sin(), azimuth.cos());

        let mut sample = block + COLUMN_HEADER_BYTES;
        for row in 0..layout.rows {
            let raw = read_i32(record, sample).unwrap_or(0);
            if raw > 0 && raw < INVALID_RANGE_MAX {
                let range = raw as f64 * RANGE_SCALE_METRES;
                let horizontal = range * vertical_cos[row];
                let model_x = horizontal * sin_azimuth;
                let model_y = horizontal * cos_azimuth;
                let model_z = range * vertical_sin[row];
                // Viewer axes, preserving the X300 model convention for the
                // calibration maths: viewer X is the model's Y and vice versa.
                positions.push(model_y as f32);
                positions.push(model_x as f32);
                positions.push(model_z as f32);

                let pulse = read_u32(record, sample + 4).unwrap_or(0) as f64;
                intensity.push((pulse / PULSE_WIDTH_MAX).min(1.0) as f32);
            }
            sample += 8;
        }
        points_per_column.push((intensity.len() - before) as u32);
    }

    ScanPoints {
        positions,
        intensity,
        column_azimuths,
        points_per_column,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Builds a minimal but structurally real X3R record.
    fn record(columns: usize, rows: usize, ranges: &[i32]) -> Vec<u8> {
        let column_stride = COLUMN_HEADER_BYTES + rows * 8;
        let mut data = vec![0u8; COLUMN_OFFSET + columns * column_stride];
        data[0..4].copy_from_slice(RECORD_MAGIC);
        data[8..12].copy_from_slice(b"DESC");
        data[32..36].copy_from_slice(&(columns as u32).to_le_bytes());
        data[44..48].copy_from_slice(&(rows as u32).to_le_bytes());
        for column in 0..columns {
            let block = COLUMN_OFFSET + column * column_stride;
            data[block..block + 4].copy_from_slice(COLUMN_MAGIC);
            // Azimuth in micro-degrees; one column per 90 degrees here.
            let azimuth = (column as i32) * 90_000_000;
            data[block + 20..block + 24].copy_from_slice(&azimuth.to_le_bytes());
            for row in 0..rows {
                let sample = block + COLUMN_HEADER_BYTES + row * 8;
                let range = ranges[(column * rows + row) % ranges.len()];
                data[sample..sample + 4].copy_from_slice(&range.to_le_bytes());
                data[sample + 4..sample + 8].copy_from_slice(&(8_191u32).to_le_bytes());
            }
        }
        data
    }

    #[test]
    fn counts_only_real_returns() {
        // 0 is "no measurement" and the sentinel is "no return"; neither is a
        // point, and both appear constantly in real sky-facing rows.
        let data = record(2, 4, &[10_000, 0, INVALID_RANGE_MAX, 20_000]);
        let layout = read_layout(&data).expect("layout");
        assert_eq!(layout.columns, 2);
        assert_eq!(layout.rows, 4);
        assert_eq!(layout.valid_points, 4, "two valid of four per column");

        let points = decode_points(&data, &layout);
        assert_eq!(points.positions.len(), layout.valid_points * 3);
        assert_eq!(points.intensity.len(), layout.valid_points);
    }

    #[test]
    fn places_a_point_by_azimuth_and_row() {
        // One column at azimuth 0, one row: the sweep's top row looks upward,
        // so the point should sit high and forward rather than out to the side.
        let data = record(1, 1, &[10_000]);
        let layout = read_layout(&data).expect("layout");
        let points = decode_points(&data, &layout);
        let (x, y, z) = (
            points.positions[0],
            points.positions[1],
            points.positions[2],
        );
        // 1 m range at azimuth 0: viewer x carries the forward component.
        assert!(x > 0.0, "forward component {x}");
        assert!(y.abs() < 1e-6, "no lateral component at azimuth 0, got {y}");
        assert!(z > 0.0, "top row looks above the horizon, got {z}");
        assert!(
            (x * x + y * y + z * z).sqrt() - 1.0 < 1e-5,
            "range preserved"
        );
    }

    #[test]
    fn scales_pulse_width_into_zero_to_one() {
        let data = record(1, 1, &[10_000]);
        let layout = read_layout(&data).expect("layout");
        let points = decode_points(&data, &layout);
        assert!(
            (points.intensity[0] - 8_191.0 / PULSE_WIDTH_MAX as f32).abs() < 1e-6,
            "intensity {}",
            points.intensity[0]
        );
    }

    #[test]
    fn rejects_records_it_cannot_read() {
        assert!(read_layout(&[0u8; 8]).is_err(), "too short");
        let mut bad = record(1, 1, &[10_000]);
        bad[0] = b'X';
        assert!(read_layout(&bad).is_err(), "wrong magic");
        let mut dimensions = record(1, 1, &[10_000]);
        dimensions[32..36].copy_from_slice(&0u32.to_le_bytes());
        assert!(read_layout(&dimensions).is_err(), "zero columns");
    }
}
