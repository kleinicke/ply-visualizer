<script lang="ts">
  import Modal from './Modal.svelte';
  import { parseSpaceSeparatedValues } from '../utils/matrix';

  let {
    title,
    label,
    defaultValue,
    inputId,
    radioName,
    radioOptions,
    resetButtonLabel,
    resetValue,
    errorMessage,
    onApply,
    onClose,
  }: {
    title: string;
    label: string;
    defaultValue: string;
    inputId: string;
    radioName: string;
    radioOptions: Array<{ value: string; label: string; checked: boolean }>;
    resetButtonLabel: string;
    resetValue: string;
    errorMessage: string;
    onApply: (values: number[], constraint: string) => void;
    onClose: () => void;
  } = $props();

  function resetToDefault() {
    const textarea = document.getElementById(inputId) as HTMLTextAreaElement;
    textarea.value = resetValue;
  }

  function apply() {
    const textarea = document.getElementById(inputId) as HTMLTextAreaElement;
    const values = parseSpaceSeparatedValues(textarea.value);
    const constraint = (
      document.querySelector(`input[name="${radioName}"]:checked`) as HTMLInputElement
    ).value;
    if (values.length === 3) {
      onApply(values, constraint);
      onClose();
    } else {
      alert(errorMessage);
    }
  }
</script>

<Modal {onClose}>
  <h3 style="margin-top:0;">{title}</h3>
  <div style="margin-bottom: 15px;">
    <label for={inputId} style="display:block;margin-bottom:5px;">{label}</label>
    <textarea
      id={inputId}
      placeholder={defaultValue}
      style="width:100%;height:60px;padding:8px;font-family:monospace;font-size:12px;border:1px solid #ccc;border-radius:4px;resize:vertical;"
      >{defaultValue}</textarea
    >
  </div>
  <div style="margin-bottom: 15px;">
    <span style="display:block;margin-bottom:8px;">Keep constant when changing:</span>
    <div style="display:flex;gap:15px;align-items:center;">
      {#each radioOptions as option (option.value)}
        <label style="display:flex;align-items:center;gap:5px;cursor:pointer;">
          <input
            type="radio"
            name={radioName}
            value={option.value}
            checked={option.checked}
            style="margin:0;"
          />
          <span>{option.label}</span>
        </label>
      {/each}
    </div>
  </div>
  <div style="text-align:right;">
    <button
      style="margin-right:10px;padding:6px 12px;background:#f0f0f0;border:1px solid #ccc;border-radius:4px;font-size:11px;"
      onclick={resetToDefault}>{resetButtonLabel}</button
    >
    <button style="margin-right:10px;padding:8px 15px;" onclick={onClose}>Cancel</button>
    <button style="padding:8px 15px;background:#007acc;color:white;border:none;border-radius:4px;" onclick={apply}
      >Apply</button
    >
  </div>
</Modal>
