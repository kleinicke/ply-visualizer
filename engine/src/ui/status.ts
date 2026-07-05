declare const acquireVsCodeApi: () => any;
const isVSCode = typeof acquireVsCodeApi !== 'undefined';

export function showError(message: string): void {
  // Log to console for developer tools visibility
  try {
    console.error(message);
  } catch (_) {}
  document.getElementById('loading')?.classList.add('hidden');
  const errorMsg = document.getElementById('error-message');
  const errorDiv = document.getElementById('error');

  if (errorMsg) {
    errorMsg.textContent = message;
  }

  if (errorDiv) {
    errorDiv.classList.remove('hidden');

    // Set up close button (only once)
    const closeBtn = document.getElementById('error-close');
    if (closeBtn && !closeBtn.hasAttribute('data-listener-added')) {
      closeBtn.setAttribute('data-listener-added', 'true');
      closeBtn.addEventListener('click', () => {
        clearError();
      });
    }

    // Set up copy button (only once)
    const copyBtn = document.getElementById('error-copy');
    if (copyBtn && !copyBtn.hasAttribute('data-listener-added')) {
      copyBtn.setAttribute('data-listener-added', 'true');
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(message);
          // Provide visual feedback
          const originalText = copyBtn.textContent;
          copyBtn.textContent = '✓';
          setTimeout(() => {
            copyBtn.textContent = originalText;
          }, 1000);
        } catch (err) {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = message;
          textArea.style.position = 'fixed';
          textArea.style.opacity = '0';
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);

          // Provide visual feedback
          const originalText = copyBtn.textContent;
          copyBtn.textContent = '✓';
          setTimeout(() => {
            copyBtn.textContent = originalText;
          }, 1000);
        }
      });
    }
  }

  // keep error visible in UI only
}

export function clearError(): void {
  const errorDiv = document.getElementById('error');
  if (errorDiv) {
    errorDiv.classList.add('hidden');
  }
}

export function showStatus(message: string): void {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${message}`);

  // Clear any existing errors when showing a status update
  clearError();

  // You could also update UI here if needed
}

/**
 * Show color mapping status message
 */
export function showColorMappingStatus(
  message: string,
  type: 'success' | 'error' | 'warning'
): void {
  const statusElement = document.getElementById('color-mapping-status');
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = `status-text ${type}`;

    // Clear after 5 seconds
    setTimeout(() => {
      statusElement.textContent = '';
      statusElement.className = 'status-text';
    }, 5000);
  }
}

export function switchTab(tabName: string): void {
  // Remove active class from all tabs and panels
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  // Add active class to selected tab and panel
  const activeTabBtn = document.querySelector(`[data-tab="${tabName}"]`);
  const activePanel = document.getElementById(`${tabName}-tab`);

  if (activeTabBtn) {
    activeTabBtn.classList.add('active');
  }
  if (activePanel) {
    activePanel.classList.add('active');
  }
}

export function showKeyboardShortcuts(onCreateShortcutsUI: () => void): void {
  console.log(`Keyboard Shortcuts:
  X: Set X-up
  Y: Set Y-up (default)
  Z: Set Z-up (CAD style)
  R: Reset camera and up vector
  T: Switch to TrackballControls
  O: Switch to OrbitControls
  I: Switch to Inverse TrackballControls
  C: Set OpenCV camera convention (Y-down)
  B: Set OpenGL camera convention (Y-up)
  W: Set rotation center to world origin (0,0,0)
  G: Toggle gamma correction
  S: Toggle screen-space scaling (distance-based point sizes)
  T: Toggle transparency (re-enable alpha blending)`);

  // Create permanent shortcuts UI section
  onCreateShortcutsUI();
}

export function createShortcutsUI(onUpdateControlStatus: () => void): void {
  // Find or create the shortcuts container
  let shortcutsDiv = document.getElementById('shortcuts-info');
  if (!shortcutsDiv) {
    shortcutsDiv = document.createElement('div');
    shortcutsDiv.id = 'shortcuts-info';
    shortcutsDiv.style.cssText = `
                margin-top: 15px;
                padding: 10px;
                background: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 4px;
                font-size: 11px;
                color: var(--vscode-foreground);
            `;

    // Insert after file stats
    const fileStats = document.getElementById('file-stats');
    if (fileStats && fileStats.parentNode) {
      fileStats.parentNode.insertBefore(shortcutsDiv, fileStats.nextSibling);
    }
  }

  shortcutsDiv.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px; color: var(--vscode-textLink-foreground);">⌨️ Keyboard Shortcuts</div>
            <div style="font-family: var(--vscode-editor-font-family); line-height: 1.4;">
                <div><span style="font-weight: bold;">X</span> Set X-up orientation</div>
                <div><span style="font-weight: bold;">Y</span> Set Y-up orientation (default)</div>
                <div><span style="font-weight: bold;">Z</span> Set Z-up orientation (CAD style)</div>
                <div><span style="font-weight: bold;">R</span> Reset camera and up vector</div>
                <div><span style="font-weight: bold;">T</span> Switch to TrackballControls</div>
                <div><span style="font-weight: bold;">O</span> Switch to OrbitControls</div>
                <div><span style="font-weight: bold;">I</span> Switch to Inverse TrackballControls</div>
                <div><span style="font-weight: bold;">K</span> Switch to ArcballControls</div>
            </div>
            <div style="font-weight: bold; margin: 8px 0 4px 0; color: var(--vscode-textLink-foreground);">📷 Camera Conventions</div>
            <div style="font-family: var(--vscode-editor-font-family); line-height: 1.4; margin-bottom: 8px;">
                <div><span id="opencv-camera" style="color: var(--vscode-textLink-foreground); cursor: pointer; text-decoration: underline;">OpenCV (Y↓) [C]</span></div>
                <div><span id="opengl-camera" style="color: var(--vscode-textLink-foreground); cursor: pointer; text-decoration: underline;">OpenGL (Y↑) [B]</span></div>
                <div><span style="color: var(--vscode-foreground);">World Origin [W]</span></div>
            </div>
            <div style="font-weight: bold; margin: 8px 0 4px 0; color: var(--vscode-textLink-foreground);">🖱️ Mouse Interactions</div>
            <div style="font-family: var(--vscode-editor-font-family); line-height: 1.4;">
                <div><span style="font-weight: bold;">Left Click + Drag</span> Move camera around</div>
                <div><span style="font-weight: bold;">Shift+Click</span> Solo point cloud (hide others)</div>
                <div><span style="font-weight: bold;">Double-Click</span> Set rotation center</div>
            </div>
            <div style="font-weight: bold; margin: 8px 0 4px 0; color: var(--vscode-textLink-foreground);">📊 Camera Controls</div>
            <div id="camera-control-status" style="font-family: var(--vscode-editor-font-family); padding: 4px; background: var(--vscode-input-background); border-radius: 2px;">
                TRACKBALL
            </div>
        `;

  // Initialize the status display
  onUpdateControlStatus();
}

export interface WelcomeMessageHost {
  spatialFiles: { length: number };
  isFileLoading: boolean;
}

export function updateWelcomeMessageVisibility(host: WelcomeMessageHost): void {
  const welcomeEl = document.getElementById('welcome-message');
  if (!welcomeEl) {
    return;
  }

  // The welcome message is a website-only hint ("click + Add Point Cloud"). In
  // the VS Code extension files are opened from the editor, so it's just noise
  // flashing behind the loading spinner — never show it there.
  if (isVSCode) {
    welcomeEl.classList.add('hidden');
    return;
  }

  // Show welcome message ONLY if:
  // 1. No files are currently loaded (spatialFiles.length === 0)
  // 2. We are NOT currently loading a file (!isFileLoading)
  if (host.spatialFiles.length === 0 && !host.isFileLoading) {
    welcomeEl.classList.remove('hidden');
  } else {
    welcomeEl.classList.add('hidden');
  }
}
