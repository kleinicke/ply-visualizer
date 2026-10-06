// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

/// Original struct: `_GUID` at `original/jxrlib/common/include/guiddef.h:43`.
#[repr(C)]
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct GUID {
    pub data1: u32,
    pub data2: u16,
    pub data3: u16,
    pub data4: [u8; 8],
}

/// Original function: `InlineIsEqualGUID` at `original/jxrlib/common/include/guiddef.h:176`.
pub fn inline_is_equal_guid(rguid1: &GUID, rguid2: &GUID) -> bool {
    rguid1 == rguid2
}

/// Original function: `IsEqualGUID` at `original/jxrlib/common/include/guiddef.h:185`.
pub fn is_equal_guid(rguid1: &GUID, rguid2: &GUID) -> bool {
    rguid1 == rguid2
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn guid_equality_compares_all_fields() {
        let one = GUID {
            data1: 0x6fddc324,
            data2: 0x4e03,
            data3: 0x4bfe,
            data4: [0xb1, 0x85, 0x3d, 0x77, 0x76, 0x8d, 0xc9, 0x0c],
        };
        let mut two = one;

        assert!(inline_is_equal_guid(&one, &two));
        assert!(is_equal_guid(&one, &two));

        two.data4[7] ^= 1;
        assert!(!inline_is_equal_guid(&one, &two));
        assert!(!is_equal_guid(&one, &two));
    }

    #[test]
    fn guid_layout_is_16_bytes() {
        assert_eq!(std::mem::size_of::<GUID>(), 16);
    }
}
