const path = require('path');
import * as vscode from 'vscode';
import axios from 'axios';
import { REQUEST_INTERVAL, BASE_URL, WORK_DIR } from './constants';

interface Command {
  type: string;
  filePath?: string;
  content?: string;
  position?: {
    row: number;
    col: number;
  };
  toPosition?: {
    row: number;
    col: number;
  };
}

function sleep(delay = 10) {
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function handleOpenFile(filePath: string) {
  await sleep(1500);
  const filenameArr = filePath.split('/');
  const filename = filenameArr[filenameArr.length - 1];
  vscode.window.showInputBox({
    value: filename,
  });
  await sleep(1500);
  const _filePath = path.resolve(WORK_DIR, filePath);
  const options = {
    selection: new vscode.Range(new vscode.Position(10, 8), new vscode.Position(10, 27)),
    preview: false,
    viewColumn: vscode.ViewColumn.One,
  };
  await vscode.window.showTextDocument(vscode.Uri.file(_filePath), options);
  let editor = vscode.window.activeTextEditor;
  if (editor) {
    console.log(editor.document.getText());
  }
}

async function handleInput(text: string, startRow: number, startCol: number) {
  await sleep(1500);
  let editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  let curRow = startRow;
  let curCol = startCol;
  for (let i = 0; i < text.length; i++) {
    await sleep();
    await editor.edit(editBuilder => {
      editBuilder.insert(new vscode.Position(curRow, curCol), text[i]);
    });
    if (text[i] === '\n') {
      curRow = curRow + 1;
    }
    curCol = curCol + 1;
  }
}

async function handleMoveCursor(toPosition: { row: number; col: number }) {
  await sleep(1500);
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

  const exec = async (commands: Array<Command>) => {
    for (let i = 0; i < commands.length; i++) {
      let command = commands[i];
      switch (command.type) {
        case 'OpenFile':
          if (command.filePath) {
            await handleOpenFile(command.filePath);
          }
          break;
        case 'Input':
          if (command.content && command.position && command.position.row && command.position.col) {
            await handleInput(command.content, command.position.row, command.position.col);
          }
          break;
        case 'MoveCursor':
          if (command.toPosition) {
            await handleMoveCursor(command.toPosition);
          }
          break;
        default:
          break;
      }
    }

    roundRobin();
  };

  function roundRobin() {
    let exampleCommands = [
      { type: 'OpenFile', filePath: './test.js' },
      {
        type: 'Input',
        content: `// (语音) JavaScript 函数是被设计为执行特定任务的代码块。
    // (语音) JavaScript 函数会在某代码调用它时被执行。

    // 下面我将教你如何在JavaScript中定义一个函数
    function A() {
      let a = 1;
      return a;
    }

    // 下面我们去 HTML文件 中通过<script>脚本的形式引入我们刚刚写的函数`,
        position: { row: 0, col: 0 },
      },
      { type: 'OpenFile', filePath: './test.html' },
      { type: 'MoveCursor', toPosition: { row: 17, col: 43 } },
      {
        type: 'Input',
        content: `
        <script src="./test.js"></script>`,
        position: { row: 17, col: 43 },
      },
    ];

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
