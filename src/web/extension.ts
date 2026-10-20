import { registerWebFileCommands } from './commands';
import * as vscode from 'vscode';
import { WebPointCloudEditorProvider } from './provider';

export function activate(context: vscode.ExtensionContext) {
  const provider = new WebPointCloudEditorProvider(context);
  context.subscriptions.push(provider);
  registerWebFileCommands(context, provider);
  void vscode.commands.executeCommand('setContext', 'plyViewer.webHost', true);
  for (const viewType of ['plyViewer.plyEditor', 'plyViewer.kittiBin', 'plyViewer.textTable']) {
    context.subscriptions.push(
      vscode.window.registerCustomEditorProvider(viewType, provider, {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      })
    );
  }
  const command = (name: string, handler: (...args: any[]) => unknown) => {
    context.subscriptions.push(vscode.commands.registerCommand(`plyViewer.${name}`, handler));
  };
  const open = async (uri?: vscode.Uri) => {
    const selected = uri ? [uri] : await provider.pickFiles();
    if (selected?.length) {
      await provider.openFiles(selected);
    }
  };
  for (const name of [
    'openFile',
    'convertTifToPointCloud',
    'convertDepthToPointCloud',
    'convertNpyToPointCloud',
    'convertPngToPointCloud',
    'convertExrToPointCloud',
    'loadJsonAsPose',
  ]) {
    command(name, open);
  }
  command('openMultipleFiles', async (uris?: readonly vscode.Uri[]) => {
    const selected = uris?.length ? uris : await provider.pickFiles();
    if (selected?.length) {
      await provider.openFiles(selected);
    }
  });
  command('showTimingOutput', () => provider.output.show());
  command('resetSettings', async () => {
    if (
      (await vscode.window.showWarningMessage(
        'Reset 3D Visualizer settings?',
        { modal: true },
        'Reset'
      )) === 'Reset'
    ) {
      await context.globalState.update('defaultDepthSettings', undefined);
      await context.globalState.update('defaultCameraConvention', undefined);
    }
  });
  // These commands depend on local filesystem scanning or native extraction.
  for (const name of ['selectDataset', 'clearDatasetCache', 'openDicomFolder']) {
    command(name, () =>
      vscode.window.showInformationMessage(
        'This command requires desktop VS Code. In the web version, use Open Multiple Files to load workspace files together.'
      )
    );
  }
  return provider;
}
