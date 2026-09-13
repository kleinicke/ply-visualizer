/* eslint-disable @typescript-eslint/naming-convention -- Shared agent wire protocol. */
import * as vscode from 'vscode';
import { randomUUID } from 'crypto';

export class NativeAgentPanels {
  private scenes = new Map<
    string,
    { panel: vscode.WebviewPanel; uri: vscode.Uri; queue: Promise<unknown>; failed: boolean }
  >();
  attach(panel: vscode.WebviewPanel, uri: vscode.Uri): void {
    const id = randomUUID();
    this.scenes.set(id, { panel, uri, queue: Promise.resolve(), failed: false });
    panel.onDidDispose(() => this.scenes.delete(id));
  }
  id(panel: vscode.WebviewPanel): string {
    const entry = [...this.scenes].find(([, s]) => s.panel === panel);
    if (!entry) {
      throw new Error('Viewer tab is closed');
    }
    return entry[0];
  }
  list() {
    return [...this.scenes].map(([scene_id, s]) => ({
      scene_id,
      title: s.panel.title,
      source: s.uri.toString(),
      active: s.panel.active,
      visible: s.panel.visible,
      connected: !s.failed,
      host: 'vscode',
    }));
  }
  close(id: string) {
    this.get(id).panel.dispose();
  }
  private get(id: string) {
    const scene = this.scenes.get(id);
    if (!scene) {
      throw new Error('Unknown or closed scene_id; call list_3d_scenes');
    }
    return scene;
  }
  async request(
    sceneId: string,
    operation: string,
    args: Record<string, any>,
    token: vscode.CancellationToken
  ): Promise<any> {
    const scene = this.get(sceneId);
    const run = scene.queue.then(async () => {
      if (token.isCancellationRequested) {
        throw new vscode.CancellationError();
      }
      if (scene.failed) {
        throw new Error(
          'Viewer connection timed out; reload the tab before sending more commands. The previous operation may have completed.'
        );
      }
      this.get(sceneId);
      scene.panel.reveal(undefined, true);
      return new Promise<any>((resolve, reject) => {
        const id = randomUUID();
        const finish = (error?: Error, result?: unknown) => {
          clearTimeout(timer);
          listener.dispose();
          closed.dispose();
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        };
        const listener = scene.panel.webview.onDidReceiveMessage(message => {
          if (message.type === 'nativeAgentReply' && message.id === id) {
            finish(message.error ? new Error(message.error) : undefined, message.result);
          }
        });
        const closed = scene.panel.onDidDispose(() =>
          finish(new Error('Viewer tab closed during operation'))
        );
        const timer = setTimeout(() => {
          scene.failed = true;
          finish(
            new Error(
              'Viewer did not reply within 120 seconds. Completion is unknown; inspect after reloading before retrying a mutation.'
            )
          );
        }, 120000);
        // Keep the queue locked until acknowledgement, even if the caller cancels:
        // interrupting a GPU operation cannot safely roll it back.
        void Promise.resolve(
          scene.panel.webview.postMessage({
            type: 'nativeAgentRequest',
            id,
            operation,
            arguments: args,
          })
        ).then(
          sent => {
            if (!sent) {
              finish(new Error('Viewer did not accept the request'));
            }
          },
          error => finish(error)
        );
      });
    });
    scene.queue = run.catch(() => undefined);
    const result = await run;
    if (token.isCancellationRequested) {
      throw new Error(
        'Invocation cancelled after dispatch; the operation may have completed. Inspect the scene before retrying.'
      );
    }
    return { ...result, scene_id: sceneId };
  }
}
export const nativeAgentPanels = new NativeAgentPanels();
