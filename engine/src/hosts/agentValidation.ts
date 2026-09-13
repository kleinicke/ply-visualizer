/** Action-dependent requirements shared by both agent transports. */
export function validateAgentCommand(operation: string, a: Record<string, any>): void {
  const require = (condition: boolean, message: string) => {
    if (!condition) {
      throw new Error(message);
    }
  };
  const present = (key: string) => a[key] !== undefined && a[key] !== null;
  if (operation === 'navigate') {
    if (a.action === 'preset') {
      require(present('preset'), 'preset is required');
    }
    if (['pan', 'pivot'].includes(a.action)) {
      require(present('vector'), 'vector is required');
    }
    if (a.action === 'pick') {
      require(present('screen'), 'screen is required');
    }
  }
  if (operation === 'object') {
    require(!(
      present('point_size') &&
      (a.point_size_mode === 'adaptive' || present('point_size_pixels'))
    ), 'Choose point_size or adaptive sizing');
    require(!(
      present('point_size_pixels') && a.point_size_mode === 'fixed'
    ), 'point_size_pixels enables adaptive mode; do not combine with fixed');
    require(!(present('color') && present('color_mode')), 'Provide color or color_mode');
  }
  if (operation === 'transform') {
    require(!present('pivot') ||
      (!a.replace &&
        ['rotate', 'quaternion', 'scale'].includes(
          a.action
        )), 'pivot requires composed rotation or scale');
    if (['translate', 'scale', 'rotate'].includes(a.action)) {
      require(present('vector'), 'vector is required');
    }
    if (a.action === 'rotate') {
      require(present('angle') &&
        a.vector.some((v: number) => v !== 0), 'Nonzero rotation axis and angle are required');
    }
    if (a.action === 'quaternion') {
      require(present('quaternion') &&
        a.quaternion.some((v: number) => v !== 0), 'Nonzero XYZW quaternion is required');
    }
    if (a.action === 'matrix') {
      require(present('matrix') &&
        [3, 7, 11, 15].every(
          (i, j) => a.matrix[i] === (j === 3 ? 1 : 0)
        ), '16 column-major affine matrix values are required (last row 0,0,0,1)');
    }
  }
  if (operation === 'measure') {
    if (a.action === 'distance') {
      require(present('start') && present('end'), 'start and end are required');
    }
    if (a.action === 'path_point') {
      require(present('end'), 'end is required');
    }
  }
  if (operation === 'video') {
    if (!present('object_index') && ['remove', 'goto', 'update'].includes(a.action)) {
      require(present('index'), 'index is required');
    }
    if (a.action === 'loop') {
      require(present('enabled'), 'enabled is required');
    }
  }
  if (operation === 'alignment') {
    if (['auto', 'icp', 'correspondences'].includes(a.action)) {
      require(present('source_index'), 'source_index is required');
    }
    if (a.action === 'correspondences') {
      require(present('source_points') &&
        present('target_points') &&
        a.source_points.length >= 3 &&
        a.source_points.length ===
          a.target_points
            .length, 'Provide equal-length source_points and target_points, at least 3 pairs');
    } else {
      require(!present('source_points') &&
        !present('target_points'), 'Landmarks are only used by correspondences');
    }
    require(!a.against_all_others ||
      ['auto', 'icp'].includes(a.action), 'against_all_others is only used by auto/icp');
    require(a.action === 'align_all' ||
      !a.strategy ||
      a.strategy === 'anchor', 'nested/complex strategies apply to align_all only');
  }
  if (operation === 'selection') {
    require(present('field') === present('values'), 'field and values must be supplied together');
    if (a.values) {
      require(a.values.length > 0 && a.values.length <= 1024, 'Provide 1..1024 values');
    }
    if (a.bounds) {
      require([0, 1, 2].every(i => a.bounds[i] <= a.bounds[i + 3]), 'Box min must not exceed max');
    }
    if (a.plane) {
      require(a.plane.slice(0, 3).some((v: number) => v !== 0), 'Plane normal must be nonzero');
    }
  }
  if (operation === 'views' && ['save', 'restore', 'delete'].includes(a.action)) {
    require(present('name'), 'name is required');
  }
  if (operation === 'named_selections') {
    if (a.action !== 'list') {
      require(present('name'), 'name is required');
    }
    if (['union', 'intersection', 'subtract'].includes(a.action)) {
      require(present('other'), 'other is required');
    }
    if (a.action === 'visible') {
      require(present('visible'), 'visible is required');
    }
  }
}
