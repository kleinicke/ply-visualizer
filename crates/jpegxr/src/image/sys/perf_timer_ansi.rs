// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

use std::time::{Duration, Instant};

use crate::image::sys::perf_timer::{
    PerfTimerClockState, PerfTimerResults, PerfTimerState, NANOSECONDS_PER_SECOND,
};

/// Original function: `AccumulateTime` at `original/jxrlib/image/sys/perfTimerANSI.c:44`.
pub unsafe fn accumulate_time(state: &mut PerfTimerState, accumulator: &mut Duration) -> bool {
    let Some(previous_start_time) = state.previous_start_time else {
        return false;
    };
    let interval_time = previous_start_time.elapsed();
    if interval_time.is_zero() {
        state.zero_time_intervals += 1;
    }

    *accumulator += interval_time;
    true
}

/// Original function: `PerfTimerNew` at `original/jxrlib/image/sys/perfTimerANSI.c:78`.
pub unsafe fn perf_timer_new() -> Option<Box<PerfTimerState>> {
    Some(Box::new(PerfTimerState {
        state: PerfTimerClockState::Stopped,
        elapsed_time: Duration::ZERO,
        previous_start_time: None,
        zero_time_intervals: 0,
    }))
}

/// Original function: `PerfTimerDelete` at `original/jxrlib/image/sys/perfTimerANSI.c:114`.
pub unsafe fn perf_timer_delete(state: &mut Option<Box<PerfTimerState>>) {
    *state = None;
}

/// Original function: `PerfTimerStart` at `original/jxrlib/image/sys/perfTimerANSI.c:121`.
pub unsafe fn perf_timer_start<T: AsMut<PerfTimerState>>(state: Option<T>) -> bool {
    let Some(mut state) = state else {
        return false;
    };
    let state = state.as_mut();

    if state.state != PerfTimerClockState::Stopped {
        return false;
    }

    state.previous_start_time = Some(Instant::now());
    state.state = PerfTimerClockState::Running;
    true
}

/// Original function: `PerfTimerStop` at `original/jxrlib/image/sys/perfTimerANSI.c:157`.
pub unsafe fn perf_timer_stop<T: AsMut<PerfTimerState>>(state: Option<T>) -> bool {
    let Some(mut state) = state else {
        return false;
    };
    let state = state.as_mut();

    if state.state != PerfTimerClockState::Running {
        return false;
    }

    let mut elapsed_time = state.elapsed_time;
    let result = accumulate_time(state, &mut elapsed_time);
    state.elapsed_time = elapsed_time;
    state.state = PerfTimerClockState::Stopped;
    result
}

/// Original function: `PerfTimerGetResults` at `original/jxrlib/image/sys/perfTimerANSI.c:185`.
pub unsafe fn perf_timer_get_results<T: AsMut<PerfTimerState>>(
    state: Option<T>,
) -> Option<PerfTimerResults> {
    let mut state = state?;
    let state = state.as_mut();

    if state.state != PerfTimerClockState::Stopped && state.state != PerfTimerClockState::Running {
        return None;
    }

    let mut i_elapsed_time = state.elapsed_time;
    if state.state == PerfTimerClockState::Running {
        if !accumulate_time(state, &mut i_elapsed_time) {
            return None;
        }
    }

    Some(PerfTimerResults {
        elapsed_time: i_elapsed_time.as_nanos() as u64,
        ticks_per_second: NANOSECONDS_PER_SECOND,
        zero_time_intervals: state.zero_time_intervals,
    })
}

/// Original function: `PerfTimerCopyStartTime` at `original/jxrlib/image/sys/perfTimerANSI.c:229`.
pub unsafe fn perf_timer_copy_start_time<D: AsMut<PerfTimerState>, S: AsRef<PerfTimerState>>(
    dest_perf_timer: Option<D>,
    src_perf_timer: Option<S>,
) -> bool {
    let Some(mut dest_perf_timer) = dest_perf_timer else {
        return false;
    };
    let dest_perf_timer = dest_perf_timer.as_mut();

    let Some(src_perf_timer) = src_perf_timer else {
        return false;
    };
    let src_perf_timer = src_perf_timer.as_ref();

    if dest_perf_timer.state != PerfTimerClockState::Running {
        return false;
    }

    if src_perf_timer.state != PerfTimerClockState::Running {
        return false;
    }

    if !dest_perf_timer.elapsed_time.is_zero() {
        return false;
    }

    dest_perf_timer.previous_start_time = src_perf_timer.previous_start_time;
    true
}
