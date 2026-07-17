use e57::{E57Writer, Record, RecordValue};
use las::{Builder, Color, Point, Writer};
use std::env;
use std::error::Error;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Clone, Copy)]
enum ScalarType {
    U8,
    U16,
    F32,
    F64,
}

impl ScalarType {
    fn from_ply_name(name: &str) -> Option<Self> {
        match name {
            "uchar" | "uint8" => Some(Self::U8),
            "ushort" | "uint16" => Some(Self::U16),
            "float" | "float32" => Some(Self::F32),
            "double" | "float64" => Some(Self::F64),
            _ => None,
        }
    }

    fn size(self) -> usize {
        match self {
            Self::U8 => 1,
            Self::U16 => 2,
            Self::F32 => 4,
            Self::F64 => 8,
        }
    }
}

#[derive(Clone, Copy)]
struct Property {
    kind: ScalarType,
    offset: usize,
}

struct Ply<'a> {
    data: &'a [u8],
    count: usize,
    stride: usize,
    x: Property,
    y: Property,
    z: Property,
    red: Property,
    green: Property,
    blue: Property,
}

impl<'a> Ply<'a> {
    fn parse(bytes: &'a [u8]) -> Result<Self, Box<dyn Error>> {
        let marker = b"end_header";
        let marker_start = bytes
            .windows(marker.len())
            .position(|window| window == marker)
            .ok_or("PLY end_header marker is missing")?;
        let line_end = bytes[marker_start..]
            .iter()
            .position(|byte| *byte == b'\n')
            .map(|offset| marker_start + offset + 1)
            .ok_or("PLY header is not newline-terminated")?;
        let header = std::str::from_utf8(&bytes[..line_end])?;
        if !header
            .lines()
            .any(|line| line.trim() == "format binary_little_endian 1.0")
        {
            return Err("converter currently requires binary_little_endian PLY".into());
        }

        let mut in_vertices = false;
        let mut count = None;
        let mut stride = 0usize;
        let mut properties = Vec::new();
        for line in header.lines() {
            let fields: Vec<_> = line.split_whitespace().collect();
            match fields.as_slice() {
                ["element", "vertex", value] => {
                    in_vertices = true;
                    count = Some(value.parse::<usize>()?);
                }
                ["element", ..] => in_vertices = false,
                ["property", kind, name] if in_vertices => {
                    let kind = ScalarType::from_ply_name(kind)
                        .ok_or_else(|| format!("unsupported vertex property type: {kind}"))?;
                    properties.push((
                        (*name).to_owned(),
                        Property {
                            kind,
                            offset: stride,
                        },
                    ));
                    stride += kind.size();
                }
                ["property", "list", ..] if in_vertices => {
                    return Err("list-valued vertex properties are unsupported".into());
                }
                _ => {}
            }
        }

        let count = count.ok_or("PLY has no vertex element")?;
        let property = |name: &str| {
            properties
                .iter()
                .find(|(candidate, _)| candidate == name)
                .map(|(_, property)| *property)
                .ok_or_else(|| format!("PLY vertex property '{name}' is missing"))
        };
        let required = count
            .checked_mul(stride)
            .and_then(|size| line_end.checked_add(size))
            .ok_or("PLY vertex data size overflow")?;
        if bytes.len() < required {
            return Err(format!(
                "truncated PLY: need {required} bytes, found {}",
                bytes.len()
            )
            .into());
        }

        Ok(Self {
            data: &bytes[line_end..required],
            count,
            stride,
            x: property("x")?,
            y: property("y")?,
            z: property("z")?,
            red: property("red")?,
            green: property("green")?,
            blue: property("blue")?,
        })
    }

    fn scalar(&self, index: usize, property: Property) -> f64 {
        let start = index * self.stride + property.offset;
        match property.kind {
            ScalarType::U8 => self.data[start] as f64,
            ScalarType::U16 => {
                u16::from_le_bytes(self.data[start..start + 2].try_into().unwrap()) as f64
            }
            ScalarType::F32 => {
                f32::from_le_bytes(self.data[start..start + 4].try_into().unwrap()) as f64
            }
            ScalarType::F64 => f64::from_le_bytes(self.data[start..start + 8].try_into().unwrap()),
        }
    }

    fn color(&self, index: usize, property: Property) -> u8 {
        let value = self.scalar(index, property);
        match property.kind {
            ScalarType::U16 => (value / 257.0).round().clamp(0.0, 255.0) as u8,
            _ => value.round().clamp(0.0, 255.0) as u8,
        }
    }

    fn point(&self, index: usize) -> ([f64; 3], [u8; 3]) {
        (
            [
                self.scalar(index, self.x),
                self.scalar(index, self.y),
                self.scalar(index, self.z),
            ],
            [
                self.color(index, self.red),
                self.color(index, self.green),
                self.color(index, self.blue),
            ],
        )
    }

    fn bounds(&self) -> ([f64; 3], [f64; 3]) {
        let mut min = [f64::INFINITY; 3];
        let mut max = [f64::NEG_INFINITY; 3];
        for index in 0..self.count {
            let (position, _) = self.point(index);
            for axis in 0..3 {
                min[axis] = min[axis].min(position[axis]);
                max[axis] = max[axis].max(position[axis]);
            }
        }
        (min, max)
    }
}

fn las_header(min: [f64; 3], max: [f64; 3]) -> Result<las::Header, Box<dyn Error>> {
    let mut builder = Builder::from((1, 2));
    builder.point_format = las::point::Format::new(2)?;
    let center = [
        (min[0] + max[0]) * 0.5,
        (min[1] + max[1]) * 0.5,
        (min[2] + max[2]) * 0.5,
    ];
    for (axis, transform) in [
        (&mut builder.transforms.x, 0),
        (&mut builder.transforms.y, 1),
        (&mut builder.transforms.z, 2),
    ] {
        let max_delta = (max[transform] - center[transform])
            .abs()
            .max((min[transform] - center[transform]).abs());
        axis.offset = center[transform];
        axis.scale = 1e-6_f64.max(max_delta / (i32::MAX as f64 - 1.0));
    }
    Ok(builder.into_header()?)
}

fn write_las(ply: &Ply<'_>, path: &Path, header: las::Header) -> Result<(), Box<dyn Error>> {
    println!("Writing {}", path.display());
    let mut writer = Writer::from_path(path, header)?;
    for index in 0..ply.count {
        let (position, color) = ply.point(index);
        writer.write_point(Point {
            x: position[0],
            y: position[1],
            z: position[2],
            color: Some(Color::new(
                color[0] as u16 * 257,
                color[1] as u16 * 257,
                color[2] as u16 * 257,
            )),
            ..Default::default()
        })?;
    }
    writer.close()?;
    Ok(())
}

fn write_e57(ply: &Ply<'_>, path: &Path, scan_name: &str) -> Result<(), Box<dyn Error>> {
    println!("Writing {}", path.display());
    let mut writer = E57Writer::from_file(path, "ply-visualizer-converted-e57")?;
    let prototype = vec![
        Record::CARTESIAN_X_F64,
        Record::CARTESIAN_Y_F64,
        Record::CARTESIAN_Z_F64,
        Record::COLOR_RED_U8,
        Record::COLOR_GREEN_U8,
        Record::COLOR_BLUE_U8,
    ];
    {
        let mut scan = writer.add_pointcloud("ply-visualizer-converted-scan", prototype)?;
        scan.set_name(Some(scan_name.to_owned()));
        for index in 0..ply.count {
            let (position, color) = ply.point(index);
            scan.add_point(vec![
                RecordValue::Double(position[0]),
                RecordValue::Double(position[1]),
                RecordValue::Double(position[2]),
                RecordValue::Integer(color[0] as i64),
                RecordValue::Integer(color[1] as i64),
                RecordValue::Integer(color[2] as i64),
            ])?;
        }
        scan.finalize()?;
    }
    writer.finalize()?;
    Ok(())
}

fn main() -> Result<(), Box<dyn Error>> {
    let mut args = env::args_os().skip(1);
    let input =
        PathBuf::from(args.next().ok_or(
            "usage: cargo run --release --example convert_ply_lidar -- INPUT.ply OUTPUT_DIR",
        )?);
    let output_dir =
        PathBuf::from(args.next().ok_or(
            "usage: cargo run --release --example convert_ply_lidar -- INPUT.ply OUTPUT_DIR",
        )?);
    if args.next().is_some() {
        return Err("too many arguments".into());
    }

    fs::create_dir_all(&output_dir)?;
    println!("Reading {}", input.display());
    let bytes = fs::read(&input)?;
    let ply = Ply::parse(&bytes)?;
    let (min, max) = ply.bounds();
    println!("Converting {} points; bounds {min:?} to {max:?}", ply.count);

    let stem = input
        .file_stem()
        .and_then(|stem| stem.to_str())
        .ok_or("input has no UTF-8 file stem")?;
    let header = las_header(min, max)?;
    write_las(
        &ply,
        &output_dir.join(format!("{stem}.las")),
        header.clone(),
    )?;
    write_las(&ply, &output_dir.join(format!("{stem}.laz")), header)?;
    write_e57(&ply, &output_dir.join(format!("{stem}.e57")), stem)?;
    println!("Done");
    Ok(())
}
