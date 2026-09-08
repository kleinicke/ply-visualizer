/* eslint-disable @typescript-eslint/naming-convention -- scalar summary wire fields */
import * as THREE from 'three';
import type { ControlHost } from './agentControls';
import { currentAgentSelection, agentAttributes } from './agentInspection';
import { parseScalarColorMode } from '../utils/scalarFields';
import { mapIntensityValue } from '../utils/intensity';
import { distanceState } from './agentComparison';
import { agentPresentation } from '../state/agentPresentation.svelte';
import { comparisonState } from './agentComparison';
export async function updateAgentLegend(host: ControlHost) {
  const selected = currentAgentSelection(host);
  const criteria = selected?.criteria;
  const description = criteria?.field
    ? `${criteria.field} ∈ {${(criteria.values as number[]).join(', ')}}`
    : criteria?.name
      ? String(criteria.name)
      : criteria?.bounds
        ? 'box region'
        : criteria?.plane
          ? 'plane region'
          : 'object subset';
  agentPresentation.selection = selected
    ? `Selection: ${selected.selected_points.toLocaleString('en-US')} points · ${description}`
    : '';
  const labels: { label: string; color: string }[] = [];
  const summaries = await agentAttributes(host.spatialFiles);
  const split = comparisonState(host);
  agentPresentation.comparison = split
    ? [
        host.spatialFiles[split.left].fileName ?? 'Left',
        host.spatialFiles[split.right].fileName ?? 'Right',
      ]
    : [];
  host.spatialFiles.forEach((file, i) => {
    if (!host.fileVisibility[i] && !(split && [split.left, split.right].includes(i))) {
      return;
    }
    if (distanceState(host, i)?.stale) {
      labels.push({ label: `${file.fileName}: distances stale — recompute`, color: '#ffbb44' });
    }
    const mode = parseScalarColorMode(host.individualColorModes[i]);
    if (!mode) {
      return;
    }
    const summary = summaries[i][mode.field] as
      | {
          min: number;
          max: number;
          value_counts: Record<string, number>;
          values_truncated: boolean;
          nonfinite_count: number;
        }
      | undefined;
    if (!summary) {
      return;
    }
    const values = Object.entries(summary.value_counts);
    // Match buildScalarColorArray: constant and nonfinite values map to 0.75.
    if (summary.nonfinite_count) {
      labels.push({
        label: `${mode.field}: ${summary.nonfinite_count} unmatched/nonfinite`,
        color: '#' + new THREE.Color(...mapIntensityValue(0.75, mode.map)).getHexString(),
      });
    }
    if (summary.values_truncated || values.length > 12) {
      for (const t of [0, 0.5, 1]) {
        const value = summary.min + t * (summary.max - summary.min);
        labels.push({
          label: `${file.fileName}: ${mode.field} ${Number(value.toPrecision(5))}`,
          color: '#' + new THREE.Color(...mapIntensityValue(t, mode.map)).getHexString(),
        });
      }
      return;
    }
    values.forEach(([value, count]) => {
      const t =
        summary.max > summary.min
          ? (Number(value) - summary.min) / (summary.max - summary.min)
          : 0.75;
      const rgb = mapIntensityValue(t, mode.map);
      labels.push({
        label: `${mode.field} ${value}: ${count.toLocaleString('en-US')} points`,
        color: '#' + new THREE.Color(...rgb).getHexString(),
      });
    });
  });
  agentPresentation.labels = labels.slice(0, 24);
}
