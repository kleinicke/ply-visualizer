<script lang="ts">
  import { uiState } from '../state/ui.svelte';

  async function copyError() {
    try {
      await navigator.clipboard.writeText(uiState.errorMessage);
    } catch (_err) {
      // Fallback for older browsers without Clipboard API access
      const textArea = document.createElement('textarea');
      textArea.value = uiState.errorMessage;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }

  function closeError() {
    uiState.isErrorVisible = false;
  }
</script>

<div id="error" class="error" class:hidden={!uiState.isErrorVisible}>
  <div class="error-header">
    <h3>Error</h3>
    <div class="error-buttons">
      <button
        id="error-copy"
        class="error-copy-btn"
        title="Copy error message"
        onclick={copyError}
      >
        📋
      </button>
      <button
        id="error-close"
        class="error-close-btn"
        title="Close error message"
        onclick={closeError}
      >
        ✕
      </button>
    </div>
  </div>
  <p
    id="error-message"
    style="user-select: text; -webkit-user-select: text; -moz-user-select: text; -ms-user-select: text;"
  >
    {uiState.errorMessage}
  </p>
</div>
