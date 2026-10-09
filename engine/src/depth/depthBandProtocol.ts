/**
 * The band worker's answer when asked to project rows it does not hold (it was
 * restarted, or never sent them): the pool then sends the rows again.
 */
export const BAND_ROWS_MISSING = 'depth band rows are not held by this worker';
