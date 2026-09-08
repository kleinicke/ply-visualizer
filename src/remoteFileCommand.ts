import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import { downloadRemoteFile, parseRemoteUrl } from '../engine/src/remoteFile';
import { detectFileType } from '../engine/src/fileHandler';

export function registerRemoteFileCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('plyViewer.openRemoteUrl', async (preset?: string) => {
    const value =
      typeof preset === 'string'
        ? preset
        : await vscode.window.showInputBox({
            title: 'Load Remote URL',
            prompt: 'URL of a point cloud, mesh, or depth image',
            placeHolder: 'https://example.com/cloud.ply',
            ignoreFocusOut: true,
            validateInput: text => {
              try {
                parseRemoteUrl(text);
                return undefined;
              } catch {
                return 'Enter an http:// or https:// URL.';
              }
            },
          });
    if (!value) {
      return;
    }
    try {
      const file = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Downloading remote 3D file…',
          cancellable: true,
        },
        async (_progress, token) => {
          const controller = new AbortController();
          const subscription = token.onCancellationRequested(() => controller.abort());
          try {
            return await downloadRemoteFile(value, controller.signal);
          } finally {
            subscription.dispose();
          }
        }
      );
      if (!detectFileType(file.name)) {
        const name = await vscode.window.showInputBox({
          prompt: 'Enter a filename with a supported extension to select the file format',
          value: file.name,
          validateInput: name =>
            detectFileType(name)
              ? undefined
              : 'Use a supported file extension, such as .ply, .xyz, or .stl.',
        });
        if (!name) {
          return;
        }
        file.name = name;
      }
      const folder = vscode.Uri.joinPath(context.globalStorageUri, 'downloads', randomUUID());
      await vscode.workspace.fs.createDirectory(folder);
      const target = vscode.Uri.joinPath(folder, file.name.split(/[\\/]/).pop()!);
      await vscode.workspace.fs.writeFile(target, file.bytes);
      await vscode.commands.executeCommand('vscode.openWith', target, 'plyViewer.plyEditor');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      await vscode.window.showErrorMessage(
        `Unable to load remote file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}
