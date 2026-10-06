// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

use crate::image::sys::strcodec::{idx_cc, tagPostProcInfo, MAX_CHANNELS};
use crate::WmpError;
use std::ptr::NonNull;

pub type PostProcInfoRows = [[Option<Box<[tagPostProcInfo]>>; 2]; MAX_CHANNELS];

/// Original function: `smoothMB` at `original/jxrlib/image/decode/postprocess.c:32`.
pub unsafe fn smooth_mb(p1: &mut i32, p0: &mut i32, q0: &mut i32, q1: &mut i32) {
    let delta = (((*q0 - *p0) << 2) + (*p1 - *q1)) >> 3;

    *q0 -= delta;
    *p0 += delta;
}

/// Original function: `smooth` at `original/jxrlib/image/decode/postprocess.c:41`.
pub unsafe fn smooth(
    p2: &mut i32,
    p1: &mut i32,
    p0: &mut i32,
    q0: &mut i32,
    q1: &mut i32,
    q2: &mut i32,
) {
    let delta = (((*q0 - *p0) << 2) + (*p1 - *q1)) >> 3;

    *q0 -= delta;
    *p0 += delta;

    *p1 = (*p1 >> 1) + ((*p0 + *p2) >> 2);
    *q1 = (*q1 >> 1) + ((*q0 + *q2) >> 2);
}

/// Original function: `initPostProc` at `original/jxrlib/image/decode/postprocess.c:53`.
pub unsafe fn init_post_proc(
    str_post_proc_info: &mut [[Option<NonNull<tagPostProcInfo>>; 2]; MAX_CHANNELS],
    str_post_proc_info_memory: &mut PostProcInfoRows,
    mb_width: usize,
    i_num_channels: usize,
) -> Result<(), WmpError> {
    let b32bit = std::mem::size_of::<i32>() == 4;

    let mut j = 0;
    while j < i_num_channels {
        let mut i = 0;
        while i < 2 {
            if b32bit
                && ((((mb_width + 2) >> 16).wrapping_mul(std::mem::size_of::<tagPostProcInfo>()))
                    & 0xffff0000)
                    != 0
            {
                return Err(WmpError::Fail);
            }

            let Some(row_len) = mb_width.checked_add(2) else {
                term_post_proc(
                    str_post_proc_info,
                    str_post_proc_info_memory,
                    mb_width,
                    i_num_channels,
                );
                return Err(WmpError::Fail);
            };
            let mut row = Vec::new();
            if row.try_reserve_exact(row_len).is_err() {
                term_post_proc(
                    str_post_proc_info,
                    str_post_proc_info_memory,
                    mb_width,
                    i_num_channels,
                );
                return Err(WmpError::Fail);
            }
            row.resize_with(row_len, tagPostProcInfo::default);
            let mut row = row.into_boxed_slice();
            let row_base = row.as_mut_ptr();

            row[0].ucMBTexture = 3;
            let mut l = 0;
            while l < 4 {
                let mut k = 0;
                while k < 4 {
                    row[0].ucBlockTexture[l][k] = 3;
                    k += 1;
                }
                l += 1;
            }
            row[mb_width + 1] = row[0];

            let Some(row_ptr) = NonNull::new(row_base.add(1)) else {
                term_post_proc(
                    str_post_proc_info,
                    str_post_proc_info_memory,
                    mb_width,
                    i_num_channels,
                );
                return Err(WmpError::Fail);
            };
            str_post_proc_info[j][i] = Some(row_ptr);
            str_post_proc_info_memory[j][i] = Some(row);

            i += 1;
        }
        j += 1;
    }

    Ok(())
}

/// Original function: `termPostProc` at `original/jxrlib/image/decode/postprocess.c:87`.
pub unsafe fn term_post_proc(
    str_post_proc_info: &mut [[Option<NonNull<tagPostProcInfo>>; 2]; MAX_CHANNELS],
    str_post_proc_info_memory: &mut PostProcInfoRows,
    _mb_width: usize,
    i_num_channels: usize,
) {
    let mut j = 0;

    while j < i_num_channels {
        let mut i = 0;
        while i < 2 {
            str_post_proc_info_memory[j][i] = None;
            str_post_proc_info[j][i] = None;
            i += 1;
        }
        j += 1;
    }
}

/// Original function: `slideOneMBRow` at `original/jxrlib/image/decode/postprocess.c:100`.
pub unsafe fn slide_one_mb_row(
    str_post_proc_info: &mut [[Option<NonNull<tagPostProcInfo>>; 2]; MAX_CHANNELS],
    str_post_proc_info_memory: &mut PostProcInfoRows,
    i_num_channels: usize,
    mb_width: usize,
    top: bool,
    bottom: bool,
) {
    let mut i = 0;
    while i < i_num_channels {
        str_post_proc_info_memory[i].swap(0, 1);
        str_post_proc_info[i].swap(0, 1);

        if top {
            let Some(row) = str_post_proc_info_memory[i][0].as_mut() else {
                return;
            };
            let edge = row[0];
            let mut j = 0;
            while j < mb_width {
                row[j + 1] = edge;
                j += 1;
            }
        }

        if bottom {
            let Some(row) = str_post_proc_info_memory[i][1].as_mut() else {
                return;
            };
            let edge = row[0];
            let mut j = 0;
            while j < mb_width {
                row[j + 1] = edge;
                j += 1;
            }
        }
        i += 1;
    }
}

/// Original function: `updatePostProcInfo` at `original/jxrlib/image/decode/postprocess.c:126`.
pub unsafe fn update_post_proc_info(
    str_post_proc_info_memory: &mut PostProcInfoRows,
    p_mb: &[i32],
    mb_x: usize,
    cc: usize,
) {
    let Some(row) = str_post_proc_info_memory[cc][1].as_mut() else {
        return;
    };
    let p_mb_info = &mut row[mb_x + 1];

    p_mb_info.iMBDC = p_mb[0];

    p_mb_info.ucMBTexture = 0;
    let mut i = 16;
    while i < 256 {
        if p_mb[i] != 0 {
            p_mb_info.ucMBTexture = 3;
            break;
        }
        i += 16;
    }

    let mut j = 0;
    while j < 4 {
        let mut i = 0;
        while i < 4 {
            let p = &p_mb[i * 64 + j * 16..];
            p_mb_info.ucBlockTexture[j][i] = 0;
            let mut k = 1;
            while k < 16 {
                if p[k] != 0 {
                    p_mb_info.ucBlockTexture[j][i] = 3;
                    break;
                }
                k += 1;
            }
            i += 1;
        }
        j += 1;
    }
}

/// Original function: `postProcMB` at `original/jxrlib/image/decode/postprocess.c:164`.
pub unsafe fn post_proc_mb(
    str_post_proc_info_memory: &mut PostProcInfoRows,
    p0: *mut i32,
    p1: *mut i32,
    mb_x: usize,
    cc: usize,
    threshold: i32,
) {
    let (top_row, bottom_row) = str_post_proc_info_memory[cc].split_at_mut(1);
    let Some(top_row) = top_row[0].as_mut() else {
        return;
    };
    let Some(bottom_row) = bottom_row[0].as_mut() else {
        return;
    };
    let p_mba = top_row[mb_x];
    let p_mbb = top_row[mb_x + 1];
    let p_mbc = bottom_row[mb_x];
    let p_mbd = bottom_row[mb_x + 1];

    if p_mba.ucMBTexture as i32 + p_mbc.ucMBTexture as i32 == 0
        && (p_mba.iMBDC - p_mbc.iMBDC).abs() <= threshold
    {
        smooth_mb(
            &mut *p0.offset(-256 + 10 * 16),
            &mut *p0.offset(-256 + 11 * 16),
            &mut *p1.offset(-256 + 8 * 16),
            &mut *p1.offset(-256 + 9 * 16),
        );
        smooth_mb(
            &mut *p0.offset(-256 + 14 * 16),
            &mut *p0.offset(-256 + 15 * 16),
            &mut *p1.offset(-256 + 12 * 16),
            &mut *p1.offset(-256 + 13 * 16),
        );
    }

    if p_mbb.ucMBTexture as i32 + p_mbd.ucMBTexture as i32 == 0
        && (p_mbb.iMBDC - p_mbd.iMBDC).abs() <= threshold
    {
        smooth_mb(
            &mut *p0.add(2 * 16),
            &mut *p0.add(3 * 16),
            &mut *p1.add(0),
            &mut *p1.add(16),
        );
        smooth_mb(
            &mut *p0.add(6 * 16),
            &mut *p0.add(7 * 16),
            &mut *p1.add(4 * 16),
            &mut *p1.add(5 * 16),
        );
    }

    if p_mba.ucMBTexture as i32 + p_mbb.ucMBTexture as i32 == 0
        && (p_mba.iMBDC - p_mbb.iMBDC).abs() <= threshold
    {
        smooth_mb(
            &mut *p0.offset(-256 + 10 * 16),
            &mut *p0.offset(-256 + 14 * 16),
            &mut *p0.add(2 * 16),
            &mut *p0.add(6 * 16),
        );
        smooth_mb(
            &mut *p0.offset(-256 + 11 * 16),
            &mut *p0.offset(-256 + 15 * 16),
            &mut *p0.add(3 * 16),
            &mut *p0.add(7 * 16),
        );
    }

    if p_mbc.ucMBTexture as i32 + p_mbd.ucMBTexture as i32 == 0
        && (p_mbc.iMBDC - p_mbd.iMBDC).abs() <= threshold
    {
        smooth_mb(
            &mut *p1.offset(-256 + 8 * 16),
            &mut *p1.offset(-256 + 12 * 16),
            &mut *p1.add(0),
            &mut *p1.add(4 * 16),
        );
        smooth_mb(
            &mut *p1.offset(-256 + 9 * 16),
            &mut *p1.offset(-256 + 13 * 16),
            &mut *p1.add(16),
            &mut *p1.add(5 * 16),
        );
    }

    bottom_row[mb_x + 1].iBlockDC[0][0] = *p1.add(0);
    bottom_row[mb_x + 1].iBlockDC[0][1] = *p1.add(4 * 16);
    bottom_row[mb_x + 1].iBlockDC[1][0] = *p1.add(16);
    bottom_row[mb_x + 1].iBlockDC[1][1] = *p1.add(5 * 16);

    top_row[mb_x + 1].iBlockDC[2][0] = *p0.add(2 * 16);
    top_row[mb_x + 1].iBlockDC[2][1] = *p0.add(6 * 16);
    top_row[mb_x + 1].iBlockDC[3][0] = *p0.add(3 * 16);
    top_row[mb_x + 1].iBlockDC[3][1] = *p0.add(7 * 16);

    bottom_row[mb_x].iBlockDC[0][2] = *p1.offset(8 * 16 - 256);
    bottom_row[mb_x].iBlockDC[0][3] = *p1.offset(12 * 16 - 256);
    bottom_row[mb_x].iBlockDC[1][2] = *p1.offset(9 * 16 - 256);
    bottom_row[mb_x].iBlockDC[1][3] = *p1.offset(13 * 16 - 256);

    top_row[mb_x].iBlockDC[2][2] = *p0.offset(10 * 16 - 256);
    top_row[mb_x].iBlockDC[2][3] = *p0.offset(14 * 16 - 256);
    top_row[mb_x].iBlockDC[3][2] = *p0.offset(11 * 16 - 256);
    top_row[mb_x].iBlockDC[3][3] = *p0.offset(15 * 16 - 256);
}

/// Original function: `postProcBlock` at `original/jxrlib/image/decode/postprocess.c:231`.
pub unsafe fn post_proc_block(
    str_post_proc_info_memory: &PostProcInfoRows,
    p0: *mut i32,
    p1: *mut i32,
    mb_x: usize,
    cc: usize,
    threshold: i32,
) {
    let mut dc = [[0_i32; 5]; 5];
    let mut texture = [[0_u8; 5]; 5];
    let (top_row, bottom_row) = str_post_proc_info_memory[cc].split_at(1);
    let Some(top_row) = top_row[0].as_ref() else {
        return;
    };
    let Some(bottom_row) = bottom_row[0].as_ref() else {
        return;
    };
    let p_mba = top_row[mb_x];
    let p_mbb = top_row[mb_x + 1];
    let p_mbc = bottom_row[mb_x];
    let p_mbd = bottom_row[mb_x + 1];

    let mut j = 0;
    while j < 4 {
        let mut i = 0;
        while i < 4 {
            dc[j][i] = p_mba.iBlockDC[j][i];
            texture[j][i] = p_mba.ucBlockTexture[j][i];
            i += 1;
        }

        dc[4][j] = p_mbc.iBlockDC[0][j];
        texture[4][j] = p_mbc.ucBlockTexture[0][j];

        dc[j][4] = p_mbb.iBlockDC[j][0];
        texture[j][4] = p_mbb.ucBlockTexture[j][0];
        j += 1;
    }

    dc[4][4] = p_mbd.iBlockDC[0][0];
    texture[4][4] = p_mbd.ucBlockTexture[0][0];

    let mut j = 0;
    while j < 4 {
        let mut i = 0;
        while i < 4 {
            let pc = p0.offset(-256 + (i * 64 + j * 16) as isize);

            if (texture[j][i] as i32 + texture[j + 1][i] as i32) < 3
                && (dc[j][i] - dc[j + 1][i]).abs() <= threshold
            {
                let pt = if j < 3 {
                    pc.add(16)
                } else {
                    p1.offset(-256 + (i * 64) as isize)
                };
                let mut k = 0;
                while k < 4 {
                    smooth(
                        &mut *pc.add(idx_cc[1][k] as usize),
                        &mut *pc.add(idx_cc[2][k] as usize),
                        &mut *pc.add(idx_cc[3][k] as usize),
                        &mut *pt.add(idx_cc[0][k] as usize),
                        &mut *pt.add(idx_cc[1][k] as usize),
                        &mut *pt.add(idx_cc[2][k] as usize),
                    );
                    k += 1;
                }
            }

            if (texture[j][i] as i32 + texture[j][i + 1] as i32) < 3
                && (dc[j][i] - dc[j][i + 1]).abs() <= threshold
            {
                let pt = pc.add(64);
                let mut k = 0;
                while k < 4 {
                    smooth(
                        &mut *pc.add(idx_cc[k][1] as usize),
                        &mut *pc.add(idx_cc[k][2] as usize),
                        &mut *pc.add(idx_cc[k][3] as usize),
                        &mut *pt.add(idx_cc[k][0] as usize),
                        &mut *pt.add(idx_cc[k][1] as usize),
                        &mut *pt.add(idx_cc[k][2] as usize),
                    );
                    k += 1;
                }
            }
            i += 1;
        }
        j += 1;
    }
}
