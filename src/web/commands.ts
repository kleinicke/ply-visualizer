import * as vscode from 'vscode';
import { downloadRemoteFile } from '../../engine/src/remoteFile';
import {
  registerUrlHistoryCommands,
  showUrlInputWithHistory,
  URL_HISTORY_STORAGE_KEY,
} from '../remoteUrlInput';
import { normalizeUrlHistory, rememberUrl } from '../urlHistory';
import type { WebPointCloudEditorProvider } from './provider';

export function registerWebFileCommands(
  context: vscode.ExtensionContext,
  provider: WebPointCloudEditorProvider
) {
  context.subscriptions.push(registerUrlHistoryCommands());
  const command = (name: string, handler: (...args: any[]) => Promise<void>) =>
    context.subscriptions.push(
      vscode.commands.registerCommand(`plyViewer.${name}`, async (...args: any[]) => {
        try {
          await handler(...args);
        } catch (error) {
          void vscode.window.showErrorMessage(String(error));
        }
      })
    );
  command('openRemoteUrl', async (preset?: string) => {
    const value = preset ?? (await showUrlInputWithHistory(context));
    if (!value) {
      return;
    }
    const file = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Downloading 3D file',
        cancellable: true,
      },
      async (_, token) => {
        const controller = new AbortController();
        const subscription = token.onCancellationRequested(() => controller.abort());
        try {
          return await downloadRemoteFile(value, controller.signal);
        } catch (error) {
          throw new Error(
            `Download failed. The server must permit browser access (CORS). ${String(error)}`
          );
        } finally {
          subscription.dispose();
        }
      }
    );
    const folder = vscode.Uri.joinPath(context.globalStorageUri, 'downloads', crypto.randomUUID());
    await vscode.workspace.fs.createDirectory(folder);
    const target = vscode.Uri.joinPath(folder, file.name);
    await vscode.workspace.fs.writeFile(target, file.bytes);
    await context.globalState.update(
      URL_HISTORY_STORAGE_KEY,
      rememberUrl(normalizeUrlHistory(context.globalState.get(URL_HISTORY_STORAGE_KEY)), value)
    );
    await provider.openFiles([target]);
  });
  command('openColmapReconstruction', async () => {
    const selected = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      title: 'Select a COLMAP reconstruction folder',
    });
    if (!selected?.length) {
      return;
    }
    const candidates = [selected[0], vscode.Uri.joinPath(selected[0], 'sparse')];
    for (const folder of candidates) {
      let entries: [string, vscode.FileType][];
      try {
        entries = await vscode.workspace.fs.readDirectory(folder);
      } catch {
        continue;
      }
      const models = entries.filter(
        ([name, type]) =>
          type === vscode.FileType.File && /^(cameras|images|points3D)\.(bin|txt)$/i.test(name)
      );
      if (models.length) {
        await provider.openFiles(models.map(([name]) => vscode.Uri.joinPath(folder, name)));
        return;
      }
      for (const [name, type] of entries.sort(([a], [b]) =>
        a.localeCompare(b, undefined, { numeric: true })
      )) {
        if (type === vscode.FileType.Directory && /^\d+$/.test(name)) {
          candidates.push(vscode.Uri.joinPath(folder, name));
        }
      }
    }
    throw new Error('No COLMAP model found in the selected folder or sparse subfolders.');
  });
  command('playPointCloudSequence', async () => {
    const pattern = await vscode.window.showInputBox({
      prompt: 'Workspace file pattern',
      placeHolder: '**/frames_*.ply',
    });
    if (!pattern) {
      return;
    }
    const files = await vscode.workspace.findFiles(pattern);
    files.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
    if (!files.length) {
      throw new Error('No workspace files match that pattern.');
    }
    await provider.startSequence(files, pattern);
  });
}
