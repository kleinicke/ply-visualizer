<script lang="ts">
  import Modal from './Modal.svelte';
  import { parseSpaceSeparatedValues } from '../utils/matrix';

  let {
    title,
    label,
    helpLines,
    defaultValue,
    expectedCount,
    errorMessage,
    inputId,
    onApply,
    onClose,
  }: {
    title: string;
    label: string;
    helpLines: string[];
    defaultValue: string;
    expectedCount: number;
    errorMessage: string;
    inputId: string;
    onApply: (values: number[]) => void;
    onClose: () => void;
  } = $props();

  function apply() {
    const textarea = document.getElementById(inputId) as HTMLTextAreaElement;
    const values = parseSpaceSeparatedValues(textarea.value);
    if (values.length === expectedCount) {
      onApply(values);
      onClose();
    } else {
      alert(errorMessage);
    }
  }
</script>

<Modal {onClose}>
  <h3 style="margin-top:0;">{title}</h3>
  <div style="margin-bottom: 15px;">
    <label for={inputId} style="display:block;margin-bottom:5px;font-weight:bold;">{label}</label>
    <div style="font-size:11px;color:#666;margin-bottom:8px;">
      {#each helpLines as line, i (i)}
        {line}<br />
      {/each}
    </div>
    <textarea
      id={inputId}
      placeholder={defaultValue}
      style="width:100%;height:80px;padding:8px;font-family:monospace;font-size:12px;border:1px solid #ccc;border-radius:4px;resize:vertical;"
      >{defaultValue}</textarea
    >
  </div>
  <div style="text-align:right;">
    <button style="margin-right:10px;padding:8px 15px;" onclick={onClose}>Cancel</button>
    <button style="padding:8px 15px;background:#007acc;color:white;border:none;border-radius:4px;" onclick={apply}
      >Apply</button
    >
  </div>
</Modal>
