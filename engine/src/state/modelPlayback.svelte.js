export function createModelPlayback() {
  const state = $state({ clip: 0, playing: false, loop: true, speed: 1, time: 0, duration: 0 });
  return state;
}
