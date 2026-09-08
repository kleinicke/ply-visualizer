/* eslint-disable @typescript-eslint/naming-convention -- MCP response keys */
/** Small acknowledgements by default; full inspection remains explicitly available. */
export function compactAgentReply(
  operation: string,
  result: Record<string, any>,
  args: Record<string, any>
) {
  const camera =
    result.camera &&
    Object.fromEntries(
      ['position', 'rotation_center', 'up', 'vertical_fov_degrees'].map(key => [
        key,
        result.camera[key],
      ])
    );
  const base = {
    ok: true,
    renderer_id: result.renderer_id,
    rendered_revision: result.rendered_revision,
  };
  if (operation === 'inspect') {
    return {
      ...base,
      camera,
      renderer_build: result.renderer_build,
      presentation: result.presentation,
      selection: result.selection,
      objects: result.objects.map((o: Record<string, any>) => ({
        object_index: o.object_index,
        name: o.name,
        vertices: o.vertices,
        visible: o.visible,
        color_mode: o.color_mode,
        scalar_fields: o.scalar_fields,
        distance: o.distance,
        animation: o.animation,
      })),
      detail_hint: 'Use detail=full for attributes, matrices, bounds and coordinate conventions.',
    };
  }
  if (operation === 'camera' || operation === 'navigate') {
    return {
      ...base,
      camera,
      ...(result.hit !== undefined ? { hit: result.hit, xyz: result.xyz } : {}),
    };
  }
  if (operation === 'appearance') {
    return { ...base, presentation: result.presentation };
  }
  if (operation === 'object' || operation === 'transform') {
    const o = result.objects[args.object_index];
    return {
      ...base,
      object:
        operation === 'transform'
          ? {
              object_index: o.object_index,
              local_to_world: o.local_to_world,
              undo_available: o.transform_undo_available,
              distance: o.distance,
            }
          : {
              object_index: o.object_index,
              visible: o.visible,
              point_size: o.point_size,
              point_size_mode: o.point_size_mode,
              point_size_pixels: o.point_size_pixels,
              opacity: o.opacity,
              color_mode: o.color_mode,
              material_colors: o.material_colors,
              points: o.points,
              mesh: o.mesh,
            },
    };
  }
  if (operation === 'alignment') {
    return {
      ...base,
      alignment: {
        busy: result.alignment.busy,
        job: result.alignment.job,
        can_undo: result.alignment.can_undo,
        ...(args.action === 'status' ? { progress: result.alignment.progress } : {}),
      },
    };
  }
  // Operation-specific results already contain the useful facts; omit the common scene dump.
  const common = new Set([
    'alignment',
    'renderer_id',
    'renderer_build',
    'rendered_revision',
    'objects',
    'bounds',
    'coordinate_system',
    'camera',
    'presentation',
    'selection',
    'visible_bounds',
  ]);
  const specific = Object.fromEntries(Object.entries(result).filter(([key]) => !common.has(key)));
  if (operation === 'views') {
    specific.views = Object.keys(result.views);
  }
  return { ...base, ...specific };
}
