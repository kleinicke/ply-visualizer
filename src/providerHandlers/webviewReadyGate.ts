export interface WebviewReadyGate {
  wait(): Promise<boolean>;
  markReady(): void;
  dispose(): void;
}

/**
 * Coordinates the extension host with a newly-created webview. `true` means
 * the webview installed its message listener; `false` means the panel went
 * away before that happened.
 */
export function createWebviewReadyGate(): WebviewReadyGate {
  let settled = false;
  let resolveReady!: (ready: boolean) => void;
  const readyPromise = new Promise<boolean>(resolve => {
    resolveReady = resolve;
  });

  const settle = (ready: boolean) => {
    if (settled) {
      return;
    }
    settled = true;
    resolveReady(ready);
  };

  return {
    wait: () => readyPromise,
    markReady: () => settle(true),
    dispose: () => settle(false),
  };
}
