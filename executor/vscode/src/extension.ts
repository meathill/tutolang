import * as path from 'path';
import * as vscode from 'vscode';
import axios from 'axios';
import { REQUEST_INTERVAL, BASE_URL, WORK_DIR, PREVIEW_TIME } from './constants';
import { OpenFileCommand, OpenFileOptions, InputCommand, MoveCursorCommand, CommandType } from './types';

const defaultOptionsForHandleOpenFile = {
  selectRange: {
    startPosition: { row: 0, col: 0 },
    endPosition: { row: 0, col: 0 },
  },
  preview: false,
  viewColumn: 1,
};

function sleep(delay = 10) {
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function handleOpenFile(filePath: string, OpenFileOptions: OpenFileOptions = defaultOptionsForHandleOpenFile) {
  await sleep(PREVIEW_TIME);
  const filenameArr = filePath.split('/');
  const filename = filenameArr[filenameArr.length - 1];
  vscode.window.showInputBox({
    value: filename,
  });
  await sleep(PREVIEW_TIME);
  const fullPath = path.resolve(WORK_DIR, filePath);
  const options: vscode.TextDocumentShowOptions = {};
  if (OpenFileOptions.selectRange) {
    options.selection = new vscode.Range(
      new vscode.Position(OpenFileOptions.selectRange.startPosition.row, OpenFileOptions.selectRange.startPosition.col),
      new vscode.Position(OpenFileOptions.selectRange.endPosition.row, OpenFileOptions.selectRange.endPosition.col)
    );
  }
  if (OpenFileOptions.preview !== undefined) {
    options.preview = OpenFileOptions.preview;
  }
  if (OpenFileOptions.viewColumn) {
    options.viewColumn = {
      1: vscode.ViewColumn.One,
      2: vscode.ViewColumn.Two,
      3: vscode.ViewColumn.Three,
    }[OpenFileOptions.viewColumn];
  }
  await vscode.window.showTextDocument(vscode.Uri.file(fullPath), options);
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    console.log(editor.document.getText());
  }
}

async function handleInput(content: string, startRow: number, startCol: number) {
  await sleep(PREVIEW_TIME);
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  let curRow = startRow;
  let curCol = startCol;
  for (let i = 0; i < content.length; i++) {
    await sleep();
    await editor.edit(editBuilder => {
      editBuilder.insert(new vscode.Position(curRow, curCol), content[i]);
    });
    if (content[i] === '\n') {
      curRow = curRow + 1;
    }
    curCol = curCol + 1;
  }
}

async function handleMoveCursor(toPosition: { row: number; col: number }) {
  await sleep(PREVIEW_TIME);
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  const fromPosition = {
    row: editor.selection.active.line,
    col: editor.selection.active.character,
  };

  while (fromPosition.row < toPosition.row) {
    fromPosition.row = Number(fromPosition.row) + 1;
    await sleep();
    editor.selection = new vscode.Selection(
      new vscode.Position(fromPosition.row, fromPosition.col),
      new vscode.Position(fromPosition.row, fromPosition.col)
    );
  }

  while (fromPosition.row > toPosition.row) {
    fromPosition.row = Number(fromPosition.row) - 1;
    await sleep();
    editor.selection = new vscode.Selection(
      new vscode.Position(fromPosition.row, fromPosition.col),
      new vscode.Position(fromPosition.row, fromPosition.col)
    );
  }

  while (fromPosition.col < toPosition.col) {
    fromPosition.col = Number(fromPosition.col) + 1;
    await sleep();
    editor.selection = new vscode.Selection(
      new vscode.Position(fromPosition.row, fromPosition.col),
      new vscode.Position(fromPosition.row, fromPosition.col)
    );
  }

  while (fromPosition.col > toPosition.col) {
    fromPosition.col = Number(fromPosition.col) - 1;
    await sleep();
    editor.selection = new vscode.Selection(
      new vscode.Position(fromPosition.row, fromPosition.col),
      new vscode.Position(fromPosition.row, fromPosition.col)
    );
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "tutolang-vscode-extension" is now active!');

  const exec = async (commands: Array<OpenFileCommand | InputCommand | MoveCursorCommand>) => {
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      switch (command.type) {
        case CommandType.OpenFile:
          await handleOpenFile(command.filePath, command.openFileOptions);
          break;
        case CommandType.Input:
          await handleInput(command.content, command.position.row, command.position.col);
          break;
        case CommandType.MoveCursor:
          await handleMoveCursor(command.toPosition);
          break;
        default:
          break;
      }
    }

    roundRobin();
  };

  function roundRobin() {
    let key = 0;
    let timer = setInterval(async () => {
      key = key + 1;
      const {
        data: { commands },
      } = await axios.get(`${BASE_URL}/query?key=${key}`);
      if (commands.length > 0) {
        clearInterval(timer);
        exec(commands);
      }
    }, REQUEST_INTERVAL);
  }

  roundRobin();

  let disposable = vscode.commands.registerCommand('tutolang-vscode-extension.codeDemo', async () => {
    vscode.window.showInformationMessage(`Hello, I'm Oreo!`);
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
