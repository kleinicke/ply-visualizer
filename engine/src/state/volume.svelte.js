export const volumeState = $state(
  /** @type {{ latestRequest: Record<string, number>; progress: Record<string, number>; errors: Record<string, string> }} */ ({
    latestRequest: {},
    progress: {},
    errors: {},
  })
);

let nextRequestId = 1;

/** @param {string} sessionId */
export function beginVolumeRequest(sessionId) {
  const requestId = nextRequestId++;
  volumeState.latestRequest[sessionId] = requestId;
  volumeState.progress[sessionId] = 0;
  volumeState.errors[sessionId] = '';
  return requestId;
}

/** @param {string} sessionId @param {number | undefined} requestId */
export function acceptVolumeResponse(sessionId, requestId) {
  return !requestId || volumeState.latestRequest[sessionId] === requestId;
}

/** @param {string} sessionId @param {number} requestId @param {number} fraction */
export function updateVolumeProgress(sessionId, requestId, fraction) {
  if (volumeState.latestRequest[sessionId] === requestId) {
    volumeState.progress[sessionId] = fraction;
  }
}

/** @param {string} sessionId @param {number} requestId @param {string} error */
export function setVolumeError(sessionId, requestId, error) {
  if (volumeState.latestRequest[sessionId] === requestId) {
    volumeState.errors[sessionId] = error;
    volumeState.progress[sessionId] = 1;
  }
}
