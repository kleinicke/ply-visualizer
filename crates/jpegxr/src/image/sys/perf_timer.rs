// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

pub const NANOSECONDS_PER_SECOND: u64 = 1_000_000_000;

use std::time::{Duration, Instant};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum PerfTimerClockState {
    #[default]
    Uninit,
    Running,
    Stopped,
}

/// Original struct: `PERFTIMERRESULTS` at `original/jxrlib/image/sys/perfTimer.h:73`.
#[derive(Debug, Clone, Copy, Default)]
pub struct PerfTimerResults {
    pub elapsed_time: u64,
    pub ticks_per_second: u64,
    pub zero_time_intervals: u64,
}

/// Original struct: `PERFTIMERSTATE` at `original/jxrlib/image/sys/perfTimer.h:94`.
#[derive(Debug, Clone, Copy, Default)]
pub struct PerfTimerState {
    pub state: PerfTimerClockState,
    pub elapsed_time: Duration,
    pub previous_start_time: Option<Instant>,
    pub zero_time_intervals: u64,
}
