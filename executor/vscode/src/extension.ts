import * as vscode from 'vscode';
import * as path from 'node:path';
import { startRpcServer, type RpcHandlers } from './rpc-server';

type OpenFileParams = {
  path: string;
  options?: { createIfMissing?: boolean; clear?: boolean; preview?: boolean; viewColumn?: number };
};

type TypeTextParams = {
  text: string;
  delayMs?: number;
};

type SetCursorParams = {
  line: number;
  column: number;
};

type HighlightLineParams = {
  line: number;
  durationMs?: number;
};

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function getFirstWorkspaceRoot(): string | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  return folder?.uri.fsPath;
}

function resolveFileUri(filePath: string): vscode.Uri {
  if (path.isAbsolute(filePath)) return vscode.Uri.file(filePath);
  const root = getFirstWorkspaceRoot();
  if (!root) {
    throw new Error('未打开工作区，无法解析相对路径');
  }
  return vscode.Uri.file(path.resolve(root, filePath));
}

function getViewColumn(viewColumn?: number): vscode.ViewColumn | undefined {
  if (!viewColumn) return undefined;
  if (viewColumn === 1) return vscode.ViewColumn.One;
  if (viewColumn === 2) return vscode.ViewColumn.Two;
  if (viewColumn === 3) return vscode.ViewColumn.Three;
  return vscode.ViewColumn.Active;
}

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('Tutolang');
  output.appendLine('tutolang-vscode-extension 已启动');

  const decoration = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: 'rgba(255, 255, 0, 0.18)',
  });

  async function openFileRpc(params: unknown): Promise<unknown> {
    const parsed = params as OpenFileParams;
    if (!parsed?.path) throw new Error('openFile 缺少 path');

    const uri = resolveFileUri(parsed.path);

    if (parsed.options?.createIfMissing) {
      try {
        await vscode.workspace.fs.stat(uri);
      } catch {
        await vscode.workspace.fs.writeFile(uri, new Uint8Array());
      }
    }

    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc, {
      preview: parsed.options?.preview ?? false,
      viewColumn: getViewColumn(parsed.options?.viewColumn),
    });

    if (parsed.options?.clear) {
      const lastLine = Math.max(0, doc.lineCount - 1);
      const fullRange = new vscode.Range(new vscode.Position(0, 0), doc.lineAt(lastLine).range.end);
      await editor.edit((editBuilder) => editBuilder.replace(fullRange, ''), { undoStopAfter: false, undoStopBefore: false });
      editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));
    }

    return { ok: true, activePath: editor.document.uri.fsPath };
  }

  async function typeTextRpc(params: unknown): Promise<unknown> {
    const parsed = params as TypeTextParams;
    const text = parsed?.text ?? '';
    const delayMs = Math.max(0, parsed?.delayMs ?? 15);

    const editor = vscode.window.activeTextEditor;
    if (!editor) throw new Error('当前没有可输入的编辑器');

    for (const ch of text) {
      await vscode.commands.executeCommand('type', { text: ch });
      if (delayMs > 0) await sleep(delayMs);
    }

    return { ok: true };
  }

  async function setCursorRpc(params: unknown): Promise<unknown> {
    const parsed = params as SetCursorParams;
    const editor = vscode.window.activeTextEditor;
    if (!editor) throw new Error('当前没有可移动光标的编辑器');

    const line = Number.isFinite(parsed?.line) ? Math.max(0, Math.floor(parsed.line)) : 0;
    const column = Number.isFinite(parsed?.column) ? Math.max(0, Math.floor(parsed.column)) : 0;

    const clampedLine = Math.min(line, Math.max(0, editor.document.lineCount - 1));
    const maxColumn = editor.document.lineAt(clampedLine).text.length;
    const clampedColumn = Math.min(column, maxColumn);
    const pos = new vscode.Position(clampedLine, clampedColumn);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    return { ok: true };
  }

  async function highlightLineRpc(params: unknown): Promise<unknown> {
    const parsed = params as HighlightLineParams;
    const editor = vscode.window.activeTextEditor;
    if (!editor) throw new Error('当前没有可高亮的编辑器');
    const line = Number.isFinite(parsed?.line) ? Math.max(0, Math.floor(parsed.line)) : 0;
    const clampedLine = Math.min(line, Math.max(0, editor.document.lineCount - 1));
    const range = editor.document.lineAt(clampedLine).range;
    editor.setDecorations(decoration, [range]);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

    const duration = parsed?.durationMs ? Math.max(0, Math.floor(parsed.durationMs)) : 800;
    if (duration > 0) {
      await sleep(duration);
      editor.setDecorations(decoration, []);
    }

    return { ok: true };
  }

  function getConfig() {
    const config = vscode.workspace.getConfiguration('tutolang');
    const port = config.get<number>('port') ?? 4001;
    const token = config.get<string>('token') || undefined;
    return { port, token };
  }

  const { port, token } = getConfig();
  const handlers: RpcHandlers = {
    ping: async () => ({ ok: true }),
    getWorkspaceRoot: async () => ({ root: getFirstWorkspaceRoot() }),
    openFile: openFileRpc,
    typeText: typeTextRpc,
    setCursor: setCursorRpc,
    highlightLine: highlightLineRpc,
  };

  const server = startRpcServer({
    port,
    token,
    handlers,
    log(message) {
      output.appendLine(message);
    },
  });

  context.subscriptions.push(
    output,
    {
      dispose() {
        server.dispose();
      },
    },
  );

  const disposable = vscode.commands.registerCommand('tutolang-vscode-extension.codeDemo', async () => {
    vscode.window.showInformationMessage('Tutolang VSCode Executor 已启动');
  });
  context.subscriptions.push(disposable);
}

export function deactivate() {}
