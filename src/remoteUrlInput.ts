import * as vscode from 'vscode';
import { normalizeUrlHistory, UrlHistoryCursor } from './urlHistory';
import { parseRemoteUrl } from '../engine/src/remoteFile';
export const URL_HISTORY_STORAGE_KEY = 'plyViewer.urlHistory';
const URL_INPUT_CONTEXT = 'plyViewer.urlInputActive';
const URL_HISTORY_PREVIOUS_COMMAND = 'plyViewer.urlHistoryPrevious';
const URL_HISTORY_NEXT_COMMAND = 'plyViewer.urlHistoryNext';

interface ActiveUrlHistoryInput {
  input: vscode.InputBox;
  cursor: UrlHistoryCursor;
  applyingHistory: boolean;
}

let activeUrlHistoryInput: ActiveUrlHistoryInput | null = null;

function moveUrlHistory(direction: 'previous' | 'next'): void {
  const active = activeUrlHistoryInput;
  if (!active) {
    return;
  }
  const value =
    direction === 'previous' ? active.cursor.previous(active.input.value) : active.cursor.next();
  if (value === null) {
    return;
  }
  active.applyingHistory = true;
  active.input.value = value;
  active.input.valueSelection = [value.length, value.length];
  queueMicrotask(() => {
    if (activeUrlHistoryInput === active) {
      active.applyingHistory = false;
    }
  });
}

/**
 * A single URL field with shell-style history. Saved URLs are deliberately not
 * rendered as choices: Up/Down only replace the field's text, and Enter always
 * submits that exact visible text.
 */
export async function showUrlInputWithHistory(
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  const history = normalizeUrlHistory(context.globalState.get(URL_HISTORY_STORAGE_KEY));
  activeUrlHistoryInput?.input.hide();
  const input = vscode.window.createInputBox();
  input.title = 'Load Remote URL';
  input.placeholder = 'Type an http:// or https:// file URL · ↑/↓ recalls history';
  input.ignoreFocusOut = true;
  const previousButton: vscode.QuickInputButton = {
    iconPath: new vscode.ThemeIcon('chevron-up'),
    tooltip: 'Previous URL (↑)',
  };
  const nextButton: vscode.QuickInputButton = {
    iconPath: new vscode.ThemeIcon('chevron-down'),
    tooltip: 'Next URL (↓)',
  };
  input.buttons = [previousButton, nextButton];
  const active: ActiveUrlHistoryInput = {
    input,
    cursor: new UrlHistoryCursor(history),
    applyingHistory: false,
  };
  activeUrlHistoryInput = active;
  await vscode.commands.executeCommand('setContext', URL_INPUT_CONTEXT, true);

  return new Promise(resolve => {
    let settled = false;
    const finish = (value?: string) => {
      if (settled) {
        return;
      }
      settled = true;
      if (activeUrlHistoryInput === active) {
        activeUrlHistoryInput = null;
        void vscode.commands.executeCommand('setContext', URL_INPUT_CONTEXT, false);
      }
      resolve(value);
      input.hide();
      input.dispose();
    };
    input.onDidChangeValue(() => {
      input.validationMessage = undefined;
      if (!active.applyingHistory) {
        active.cursor.reset();
      }
    });
    input.onDidTriggerButton(button => {
      moveUrlHistory(button === previousButton ? 'previous' : 'next');
    });
    input.onDidAccept(() => {
      try {
        parseRemoteUrl(input.value);
        finish(input.value.trim());
      } catch {
        input.validationMessage = 'Enter an http:// or https:// URL.';
      }
    });
    input.onDidHide(() => finish());
    input.show();
  });
}

export function registerUrlHistoryCommands(): vscode.Disposable {
  return vscode.Disposable.from(
    vscode.commands.registerCommand(URL_HISTORY_PREVIOUS_COMMAND, () => moveUrlHistory('previous')),
    vscode.commands.registerCommand(URL_HISTORY_NEXT_COMMAND, () => moveUrlHistory('next')),
    new vscode.Disposable(() => activeUrlHistoryInput?.input.hide())
  );
}
