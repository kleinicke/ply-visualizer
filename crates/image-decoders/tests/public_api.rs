#[cfg(feature = "netpbm")]
use scientific_image_decoders::decode_netpbm;
#[cfg(feature = "pfm")]
use scientific_image_decoders::decode_pfm;
use scientific_image_decoders::DecodeError;
#[cfg(feature = "png")]
use scientific_image_decoders::{decode_png16_fast, decode_png_samples_fast};

#[cfg(feature = "png")]
#[test]
fn raw_png_decode_preserves_native_grayscale_samples() {
    for (depth, samples, expected) in [
        (png::BitDepth::Eight, vec![7, 249], vec![7, 249]),
        (
            png::BitDepth::Sixteen,
            vec![0x01, 0x23, 0xfe, 0xdc],
            vec![0x0123, 0xfedc],
        ),
    ] {
        let mut encoded = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut encoded, 2, 1);
            encoder.set_color(png::ColorType::Grayscale);
            encoder.set_depth(depth);
            let mut writer = encoder.write_header().expect("PNG header");
            writer.write_image_data(&samples).expect("PNG samples");
        }

        let mut decoded = decode_png_samples_fast(&encoded).expect("raw PNG decode");
        assert_eq!(
            (decoded.width(), decoded.height(), decoded.channels()),
            (2, 1, 1)
        );
        assert_eq!(
            decoded.bit_depth(),
            if depth == png::BitDepth::Eight { 8 } else { 16 }
        );
        assert_eq!(decoded.take_data_as_u16(), expected);

        if depth == png::BitDepth::Eight {
            assert!(decode_png16_fast(&encoded).is_err());
        }
    }
}

#[cfg(feature = "netpbm")]
#[test]
fn decodes_binary_pgm_through_public_api() {
    let mut encoded = b"P5\n2 1\n255\n".to_vec();
    encoded.extend_from_slice(&[7, 249]);

    let mut decoded = decode_netpbm(&encoded).expect("PGM should decode");
    assert_eq!(
        (decoded.width(), decoded.height(), decoded.channels()),
        (2, 1, 1)
    );
    assert_eq!(decoded.sample_kind(), 1);
    assert_eq!(decoded.take_data_as_u8().unwrap(), vec![7, 249]);
    assert!(
        decoded.take_data_as_u8().is_err(),
        "pixel buffers are one-shot"
    );
}

#[cfg(feature = "pfm")]
#[test]
fn decodes_little_endian_pfm_through_public_api() {
    let mut encoded = b"Pf\n2 1\n-1.0\n".to_vec();
    encoded.extend_from_slice(&1.5f32.to_le_bytes());
    encoded.extend_from_slice(&(-2.0f32).to_le_bytes());

    let mut decoded = decode_pfm(&encoded, true).expect("PFM should decode");
    assert_eq!(
        (decoded.width(), decoded.height(), decoded.channels()),
        (2, 1, 1)
    );
    assert_eq!(decoded.take_data_as_f32().unwrap(), vec![1.5, -2.0]);
}

#[test]
fn decode_error_is_a_normal_rust_error() {
    let error = DecodeError::new("bad bytes");
    let as_error: &dyn std::error::Error = &error;
    assert_eq!(as_error.to_string(), "bad bytes");
}
