/* eslint-disable @typescript-eslint/naming-convention -- MCP wire keys */
import type { ControlHost } from './agentControls';
export function agentModelAnimation(host: ControlHost, a: Record<string, any>) {
  const model = host.spatialFiles[a.object_index]?.sceneModel;
  if (!model) {
    throw new Error('object_index must identify a scene model; inspect animation.clips first');
  }
  if (!['list', 'play', 'stop', 'loop', 'goto', 'update'].includes(a.action)) {
    throw new Error(
      'Model animation actions: list, play, stop, loop, goto(time), update(index/speed)'
    );
  }
  if (a.index !== undefined && !model.clips[a.index]) {
    throw new Error('Unknown animation clip index');
  }
  if (a.action !== 'list' && !model.clips.length) {
    throw new Error('This model contains no animation clips');
  }
  if (a.action === 'goto' && a.time === undefined) {
    throw new Error('Model goto requires time in seconds');
  }
  if (a.index !== undefined) {
    model.selectClip(a.index);
  }
  if (a.speed !== undefined) {
    model.ui.speed = a.speed;
  }
  if (a.action === 'play') {
    model.ui.playing = true;
  }
  if (a.action === 'stop') {
    model.ui.playing = false;
  }
  if (a.action === 'loop') {
    model.ui.loop = a.enabled;
  }
  if (a.action === 'goto') {
    model.ui.playing = false;
    model.seek(a.time);
  }
  host.requestRender();
  return {
    object_index: a.object_index,
    animation: {
      ...model.ui,
      clips: model.clips.map((clip, index) => ({
        index,
        name: clip.name,
        duration: clip.duration,
      })),
      warnings: model.warnings,
    },
  };
}
