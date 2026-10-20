import { MtlParser } from '../../engine/src/parsers/mtlParser';
import {
  handleCameraParametersRequest,
  handleCameraParametersWithScaleRequest,
} from '../providerHandlers/cameraParamsHandlers';
import { isSceneModel, isModelCompanion } from '../../engine/src/models/modelFormats';
import * as vscode from 'vscode';
import { renderWebviewHtml } from '../webviewHtml';
import { createWebviewReadyGate } from '../providerHandlers/webviewReadyGate';
import { readHostMessage } from '../../engine/src/hosts/hostProtocol';

interface Viewer {
  panel: vscode.WebviewPanel;
  ready: ReturnType<typeof createWebviewReadyGate>;
  initial: Promise<void>;
  sources: Map<string, vscode.Uri>;
  sequence: Set<string>;
  pending: Map<string, { resolve(value: unknown): void; reject(error: Error): void }>;
}

/** Workspace I/O stays in the extension; parsing and rendering run in the webview. */
export class WebPointCloudEditorProvider
  implements vscode.CustomReadonlyEditorProvider, vscode.Disposable
{
  readonly output = vscode.window.createOutputChannel('3D Visualizer');
  private readonly viewers = new Map<string, Viewer>();
  private readonly queuedFiles = new Map<string, readonly vscode.Uri[]>();

  constructor(private readonly context: vscode.ExtensionContext) {}

  openCustomDocument(uri: vscode.Uri): vscode.CustomDocument {
    return { uri, dispose() {} };
  }

  async resolveCustomEditor(
    document: vscode.CustomDocument,
    panel: vscode.WebviewPanel
  ): Promise<void> {
    const key = document.uri.toString();
    const ready = createWebviewReadyGate();
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };
    const viewer: Viewer = {
      panel,
      ready,
      initial: Promise.resolve(),
      sources: new Map(),
      sequence: new Set(),
      pending: new Map(),
    };
    this.viewers.set(key, viewer);
    const subscriptions: vscode.Disposable[] = [];
    const bootTimer = setTimeout(() => {
      ready.dispose();
      void vscode.window.showErrorMessage(
        'The 3D viewer did not start. Close and reopen the file to retry.'
      );
    }, 60000);
    void ready.wait().then(() => clearTimeout(bootTimer));
    panel.onDidDispose(() => {
      ready.dispose();
      if (this.viewers.get(key) === viewer) {
        this.viewers.delete(key);
      }
      for (const pending of viewer.pending.values()) {
        pending.reject(new Error('Viewer closed'));
      }
      viewer.pending.clear();
      for (const subscription of subscriptions) {
        subscription.dispose();
      }
    });
    subscriptions.push(
      panel.webview.onDidReceiveMessage(raw => {
        void this.handleMessage(viewer, raw).catch(error => {
          void vscode.window.showErrorMessage(`3D Visualizer: ${String(error)}`);
        });
      })
    );
    subscriptions.push(
      panel.onDidChangeViewState(() => {
        void panel.webview.postMessage({ type: 'viewVisibility', visible: panel.visible });
      })
    );
    const files = this.queuedFiles.get(key) ?? [document.uri];
    this.queuedFiles.delete(key);
    viewer.initial = this.sendFiles(viewer, files);
    try {
      const template = await vscode.workspace.fs.readFile(
        vscode.Uri.joinPath(this.context.extensionUri, 'engine/index.html')
      );
      if (this.viewers.get(key) !== viewer) {
        return;
      }
      panel.webview.html = renderWebviewHtml(
        new TextDecoder().decode(template),
        panel.webview,
        this.context.extensionUri,
        undefined,
        undefined,
        undefined,
        true
      );
    } catch (error) {
      ready.dispose();
      throw error;
    }
  }

  pickFiles() {
    return vscode.window.showOpenDialog({
      canSelectMany: true,
      canSelectFiles: true,
      canSelectFolders: false,
      title: 'Open 3D files together',
    });
  }

  async openFiles(uris: readonly vscode.Uri[]): Promise<void> {
    if (!uris.length) {
      return;
    }
    const key = uris[0].toString();
    const existing = this.viewers.get(key);
    if (existing) {
      existing.panel.reveal();
      await existing.initial;
      if (uris.length > 1) {
        await this.sendFiles(existing, uris.slice(1));
      }
      return;
    }
    this.queuedFiles.set(key, uris);
    try {
      await vscode.commands.executeCommand('vscode.openWith', uris[0], 'plyViewer.plyEditor');
    } finally {
      this.queuedFiles.delete(key);
    }
  }

  private async sendFiles(viewer: Viewer, uris: readonly vscode.Uri[]): Promise<void> {
    if (!(await viewer.ready.wait())) {
      return;
    }
    try {
      const selected = await Promise.all(
        uris.map(async uri => ({
          uri,
          name: uri.path.split('/').pop()!,
          data: await vscode.workspace.fs.readFile(uri),
        }))
      );
      const hasModels = selected.some(file => isSceneModel(file.name));
      const resources = selected
        .filter(file => isModelCompanion(file.name))
        .map(({ name, data }) => ({ name, data }));
      const files = [];
      for (const { uri, name, data } of selected) {
        if (/\.(step|stp|iges|igs|brep)$/i.test(name)) {
          throw new Error(
            'CAD conversion requires desktop VS Code. Export the model as GLB, OBJ or STL to view it here.'
          );
        }
        if (isSceneModel(name)) {
          const sourceId = crypto.randomUUID();
          viewer.sources.set(sourceId, uri);
          await viewer.panel.webview.postMessage({
            type: 'sceneModelData',
            sourceId,
            fileName: name,
            data,
            resources,
          });
        } else if (!hasModels || !isModelCompanion(name)) {
          files.push({ name, data });
        }
      }
      if (files.length) {
        await viewer.panel.webview.postMessage({ type: 'browserFiles', files });
      }
    } catch (error) {
      await viewer.panel.webview.postMessage({
        type: 'loadingError',
        error: `Could not read file: ${String(error)}`,
      });
    }
  }

  async startSequence(uris: vscode.Uri[], pattern: string): Promise<void> {
    if (!uris.length) {
      return;
    }
    await this.openFiles([uris[0]]);
    const viewer = this.viewers.get(uris[0].toString());
    if (!viewer) {
      return;
    }
    await viewer.initial;
    viewer.sequence = new Set(uris.map(uri => uri.toString()));
    await viewer.panel.webview.postMessage({
      type: 'sequence:init',
      files: [...viewer.sequence],
      wildcard: pattern,
    });
  }

  /** Same request protocol used by the desktop host, useful to integrations and tests. */
  async request(
    uri: vscode.Uri,
    operation: string,
    args: Record<string, unknown> = {}
  ): Promise<unknown> {
    const viewer = this.viewers.get(uri.toString());
    if (!viewer) {
      throw new Error('No viewer for this document');
    }
    await viewer.initial;
    if (!(await viewer.ready.wait()) || this.viewers.get(uri.toString()) !== viewer) {
      throw new Error('Viewer is unavailable');
    }
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        viewer.pending.delete(id);
        reject(new Error(`Viewer request timed out: ${operation}`));
      }, 30000);
      viewer.pending.set(id, {
        resolve: value => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: error => {
          clearTimeout(timer);
          reject(error);
        },
      });
      const failed = (error: Error) => {
        viewer.pending.get(id)?.reject(error);
        viewer.pending.delete(id);
      };
      void viewer.panel.webview
        .postMessage({
          type: 'nativeAgentRequest',
          id,
          operation,
          arguments: args,
        })
        .then(
          delivered => {
            if (!delivered) {
              failed(new Error('Viewer is unavailable'));
            }
          },
          error => failed(error instanceof Error ? error : new Error(String(error)))
        );
    });
  }

  private async handleMessage(viewer: Viewer, raw: unknown): Promise<void> {
    const message = readHostMessage(raw);
    if (!message) {
      return;
    }
    const post = (value: unknown) => viewer.panel.webview.postMessage(value);
    switch (message.type) {
      case 'webviewReady':
        await this.handleMessage(viewer, { type: 'requestDefaultDepthSettings' });
        viewer.ready.markReady();
        break;
      case 'nativeAgentReply': {
        const pending = viewer.pending.get(message.id);
        viewer.pending.delete(message.id);
        if (message.error) {
          pending?.reject(new Error(message.error));
        } else {
          pending?.resolve(message.result);
        }
        break;
      }
      case 'perfLog':
        this.output.appendLine(message.line);
        break;
      case 'error':
        void vscode.window.showErrorMessage(message.message);
        break;
      case 'info':
        void vscode.window.showInformationMessage(message.message);
        break;
      case 'addFile': {
        const files = await this.pickFiles();
        if (files?.length) {
          await this.sendFiles(viewer, files);
        }
        break;
      }
      case 'requestCameraParams':
        await handleCameraParametersRequest(this.context, viewer.panel, message);
        break;
      case 'requestCameraParamsWithScale':
        await handleCameraParametersWithScaleRequest(this.context, viewer.panel, message);
        break;
      case 'addFileFromPath': {
        const uri = vscode.Uri.joinPath(vscode.Uri.parse(message.path), '.');
        const authorized = vscode.workspace.workspaceFolders?.some(
          folder =>
            uri.scheme === folder.uri.scheme &&
            uri.authority === folder.uri.authority &&
            uri.path.startsWith(folder.uri.path.replace(/\/$/, '') + '/')
        );
        if (!authorized) {
          throw new Error('Drop a file from the open workspace, or use Add File.');
        }
        await this.sendFiles(viewer, [uri]);
        break;
      }
      case 'loadMtl': {
        const selected = await vscode.window.showOpenDialog({
          canSelectMany: false,
          filters: { 'Material files': ['mtl'] },
        });
        if (!selected?.length) {
          break;
        }
        const parsed = await new MtlParser().parse(await vscode.workspace.fs.readFile(selected[0]));
        await post({
          type: 'mtlData',
          fileIndex: message.fileIndex,
          entryId: message.entryId,
          data: {
            materials: Object.fromEntries(parsed.materials),
            materialCount: parsed.materials.size,
          },
        });
        break;
      }
      case 'saveDefaultDepthSettings':
        await this.context.globalState.update('defaultDepthSettings', message.settings);
        break;
      case 'saveCameraConvention':
        await this.context.globalState.update('defaultCameraConvention', message.convention);
        break;
      case 'requestDefaultDepthSettings':
        await post({
          type: 'defaultDepthSettings',
          settings: this.context.globalState.get('defaultDepthSettings') ?? {
            fx: 1000,
            cameraModel: 'pinhole-ideal',
            depthType: 'euclidean',
            convention: 'opengl',
          },
          viewConvention: this.context.globalState.get('defaultCameraConvention'),
        });
        break;
      case 'savePlyFile':
      case 'saveCameraPath':
      case 'saveMeasurementPaths':
      case 'saveScreenshot':
      case 'saveVideo': {
        const target = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.joinPath(
            vscode.workspace.workspaceFolders?.[0]?.uri ?? this.context.globalStorageUri,
            message.defaultFileName
          ),
        });
        let success = false;
        try {
          if (target) {
            const bytes =
              'content' in message
                ? new TextEncoder().encode(message.content as string)
                : Uint8Array.from(atob(message.dataBase64 as string), char => char.charCodeAt(0));
            await vscode.workspace.fs.writeFile(target, bytes);
            success = true;
          }
        } finally {
          if (message.type === 'savePlyFile') {
            await post({ type: 'savePlyFileResult', success });
          }
        }
        break;
      }
      case 'selectColorImage':
      case 'selectCalibrationFile': {
        const selected = await vscode.window.showOpenDialog({ canSelectMany: false });
        if (!selected?.length) {
          break;
        }
        const data = await vscode.workspace.fs.readFile(selected[0]);
        const common = {
          fileIndex: message.fileIndex,
          entryId: message.entryId,
          fileName: selected[0].path.split('/').pop()!,
        };
        await post(
          message.type === 'selectColorImage'
            ? { type: 'colorImageData', ...common, data }
            : {
                type: 'calibrationFileSelected',
                ...common,
                content: new TextDecoder().decode(data),
              }
        );
        break;
      }
      case 'modelResourceRequest': {
        try {
          const source = viewer.sources.get(message.sourceId);
          if (!source) {
            throw new Error('Unknown model');
          }
          const base = vscode.Uri.joinPath(source, '..');
          const relative = decodeURIComponent(message.relative).replace(/\\/g, '/');
          const target = vscode.Uri.joinPath(base, relative);
          if (
            /^[a-z]+:|^\//i.test(relative) ||
            !target.path.startsWith(base.path.replace(/\/$/, '') + '/')
          ) {
            throw new Error('Model resources must be inside the model directory');
          }
          const data = await vscode.workspace.fs.readFile(target);
          await post({ type: 'modelResourceResult', requestId: message.requestId, data });
        } catch (error) {
          await post({
            type: 'modelResourceResult',
            requestId: message.requestId,
            error: String(error),
          });
        }
        break;
      }
      case 'sequence:requestFile': {
        try {
          if (!viewer.sequence.has(message.path)) {
            throw new Error('Unknown sequence frame');
          }
          const uri = vscode.Uri.parse(message.path);
          const data = await vscode.workspace.fs.readFile(uri);
          await post({
            type: 'sequence:file',
            requestId: message.requestId,
            index: message.index,
            fileName: uri.path.split('/').pop(),
            data,
          });
        } catch (error) {
          await post({
            type: 'sequence:file:error',
            requestId: message.requestId,
            index: message.index,
            error: String(error),
          });
        }
        break;
      }
      case 'sequence:cancelFile':
        break; // The viewer ignores replies to obsolete requests.
      case 'removeFile':
        await post({ type: 'fileRemoved', fileIndex: message.fileIndex, entryId: message.entryId });
        break;
      default:
        void vscode.window.showWarningMessage(
          `This operation (${message.type}) is not available in web VS Code.`
        );
    }
  }

  dispose(): void {
    for (const viewer of this.viewers.values()) {
      viewer.panel.dispose();
    }
    this.output.dispose();
  }
}
