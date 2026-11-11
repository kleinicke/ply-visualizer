<script lang="ts">
  import type { Snippet } from 'svelte';

  // A dialog over the whole window: backdrop, Esc / backdrop click to close,
  // and the viewer's keyboard shortcuts kept out while it is open. Mounted on
  // <body> so the side panel's layout and scrolling are untouched.
  let {
    title,
    onclose,
    width = 440,
    children,
    footer,
  }: {
    title: string;
    onclose: () => void;
    width?: number;
    children: Snippet;
    footer?: Snippet;
  } = $props();

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    const previous = document.activeElement as HTMLElement | null;
    // First field, else the dialog itself.
    const first = node.querySelector<HTMLElement>(
      'input:not([disabled]):not([type="radio"]), input[type="radio"]:checked, select, textarea',
    );
    (first ?? node.querySelector<HTMLElement>('.modal'))?.focus();
    if (first instanceof HTMLInputElement && first.type !== 'radio') {
      first.select();
    }
    return {
      destroy() {
        node.remove();
        previous?.focus?.();
      },
    };
  }

  function onKeydown(event: KeyboardEvent) {
    // Digits, arrows etc. belong to the dialog, not the 3D view or solo.
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      onclose();
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
  class="modal-backdrop"
  data-no-scene-render
  use:portal
  onkeydown={onKeydown}
  onpointerdown={(event) => event.target === event.currentTarget && onclose()}
>
  <div
    class="modal"
    role="dialog"
    aria-modal="true"
    aria-label={title}
    tabindex="-1"
    style="width: min({width}px, 100%);"
  >
    <div class="modal-head">
      <h2>{title}</h2>
      <button class="modal-close" title="Close (Esc)" aria-label="Close" onclick={onclose}>✕</button>
    </div>
    <div class="modal-body">{@render children()}</div>
    {#if footer}
      <div class="modal-foot">{@render footer()}</div>
    {/if}
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 2147483000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(0, 0, 0, 0.45);
  }
  .modal {
    max-height: calc(100vh - 32px);
    display: flex;
    flex-direction: column;
    background: var(--vscode-editor-background, #1e1e1e);
    color: var(--vscode-foreground, #ccc);
    border: 1px solid var(--vscode-sideBar-border, #444);
    border-radius: 8px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    font: 13px/1.45 var(--vscode-font-family, system-ui, sans-serif);
    outline: none;
  }
  .modal-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 16px 6px 20px;
  }
  .modal-head h2 {
    flex: 1;
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .modal-close {
    font: inherit;
    color: inherit;
    background: transparent;
    border: 0;
    border-radius: 3px;
    padding: 2px 6px;
    cursor: pointer;
    opacity: 0.7;
  }
  .modal-close:hover {
    opacity: 1;
    background: var(--vscode-list-hoverBackground, rgba(127, 127, 127, 0.2));
  }
  .modal-body {
    padding: 4px 20px 16px;
    overflow: auto;
  }
  .modal-foot {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 0 20px 18px;
  }
</style>
