<script lang="ts">
  import {
    DEFAULT_E57_IMAGE_CORRECTION,
    e57ImageCorrectionEquals,
    normalizeE57ImageCorrection,
    type E57ImageCorrection,
  } from '../visualization/e57ImageCorrection';
  import { setE57ImageCorrection } from '../visualization/e57Cameras';

  let { host, cameraGroup, index }: { host: any; cameraGroup: any; index: number } = $props();

  const initial = () => cameraGroup?.userData ?? {};
  let correction = $state<E57ImageCorrection>(
    normalizeE57ImageCorrection(initial().imageCorrection)
  );
  let applying = $state(false);

  const representations: string[] = initial().imageRepresentations ?? [];
  const hasPanorama = representations.some(r => r !== 'pinhole');
  const hasPinhole = representations.includes('pinhole');
  const isDefault = $derived(e57ImageCorrectionEquals(correction, DEFAULT_E57_IMAGE_CORRECTION));

  // Rebuilding re-decodes every JPEG and repaints the cloud, so changes commit
  // on release rather than while dragging.
  async function apply(patch: Partial<E57ImageCorrection>) {
    correction = { ...correction, ...patch };
    applying = true;
    try {
      await setE57ImageCorrection(host, cameraGroup, correction);
    } finally {
      applying = false;
      host.requestRender();
    }
  }

  const LABEL = 'font-size:10px;display:flex;align-items:center;gap:6px;';
  const NESTED = `${LABEL}padding-left:14px;`;
</script>

<div style="margin-top:4px;">
  <label
    style={LABEL}
    title="These files follow the E57 spec exactly when this is off. Some exporters store imagery that does not match the spec, and this shifts it back."
  >
    <input
      type="checkbox"
      id={`e57-correction-${index}`}
      checked={correction.enabled}
      disabled={applying}
      onchange={e => apply({ enabled: (e.currentTarget as HTMLInputElement).checked })}
    />
    Correct image alignment
    {#if applying}<span style="opacity:0.7;">— reloading…</span>{/if}
  </label>

  {#if correction.enabled}
    {#if hasPanorama}
      <label
        style={NESTED}
        title="Rotation about the vertical axis applied to panoramas. Measured at -90° on the sample files that can be checked against their own point colours. Double-click to reset."
      >
        Panorama azimuth
        <input
          type="range"
          min="-180"
          max="180"
          step="15"
          value={correction.azimuthDegrees}
          disabled={applying}
          onchange={e => apply({ azimuthDegrees: Number((e.currentTarget as HTMLInputElement).value) })}
          ondblclick={e => {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).value = String(
              DEFAULT_E57_IMAGE_CORRECTION.azimuthDegrees
            );
            apply({ azimuthDegrees: DEFAULT_E57_IMAGE_CORRECTION.azimuthDegrees });
          }}
        />
        <span style="min-width:34px;text-align:right;">{correction.azimuthDegrees}°</span>
      </label>
    {/if}

    {#if hasPinhole}
      <label style={NESTED} title="Mirror pinhole photos top-to-bottom.">
        <input
          type="checkbox"
          checked={correction.flipVertical}
          disabled={applying}
          onchange={e => apply({ flipVertical: (e.currentTarget as HTMLInputElement).checked })}
        />
        Flip photos vertically
      </label>
      <label style={NESTED} title="Mirror pinhole photos left-to-right.">
        <input
          type="checkbox"
          checked={correction.flipHorizontal}
          disabled={applying}
          onchange={e => apply({ flipHorizontal: (e.currentTarget as HTMLInputElement).checked })}
        />
        Flip photos horizontally
      </label>
    {/if}

    {#if !isDefault}
      <button
        type="button"
        style="font-size:10px;margin-left:14px;margin-top:2px;background:transparent;color:var(--vscode-foreground);border:1px solid var(--vscode-panel-border, rgba(128,128,128,0.4));border-radius:2px;padding:1px 6px;cursor:pointer;"
        disabled={applying}
        onclick={() => apply({ ...DEFAULT_E57_IMAGE_CORRECTION })}
      >
        Reset to defaults
      </button>
    {/if}
  {/if}
</div>
