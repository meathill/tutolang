import * as vscode from 'vscode';
import axios from 'axios';
import constant from './constant';

const sleep = (delay = 90) => new Promise(resolve => setTimeout(resolve, delay));

const handleInputOneWord = async (
  editor: vscode.TextEditor | undefined,
  word: string,
  startRow: number,
  startCol: number
) => {
  if (!editor) {
    return;
  }
  await sleep();
  await editor.edit(editBuilder => {
    editBuilder.insert(new vscode.Position(startRow, startCol), word);
  });
};

const handleInput = async (editor: vscode.TextEditor | undefined, text: string, startRow: number, startCol: number) => {
  if (!editor) {
    return;
  }
  let curRow = startRow;
  let curCol = startCol;
  for (let i = 0; i < text.length; i++) {
    await handleInputOneWord(editor, text[i], curRow, curCol);
    if (text[i] === '\n') {
      curRow = curRow + 1;
    }
    curCol = curCol + 1;
  }
};

const handleMoveCursor = async (
  editor: vscode.TextEditor | undefined,
  fromPosition: { row: number; col: number },
  toPosition: { row: number; col: number }
) => {
  if (!editor) {
    return;
  }
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
};

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "tutolang-vscode-extension" is now active!');

  const exec = async () => {
    let editor = vscode.window.activeTextEditor;

    let text = `// (语音) JavaScript 函数是被设计为执行特定任务的代码块。
// (语音) JavaScript 函数会在某代码调用它时被执行。

// 下面我将教你如何在JavaScript中定义一个函数
function A() {
	let a = 1;
	return a;
}

// 下面我们去 HTML文件 中通过<script>脚本的形式引入我们刚刚写的函数`;

    await handleInput(editor, text, 0, 0);

    await sleep(1500);

    vscode.window.showInputBox({
      value: 'test.html',
    });

    await sleep(1500);

    const path = '/Users/oreo/workspace/html/test.html';
    const options = {
      selection: new vscode.Range(new vscode.Position(10, 8), new vscode.Position(10, 27)),
      preview: false,
      viewColumn: vscode.ViewColumn.One,
    };

    await vscode.window.showTextDocument(vscode.Uri.file(path), options);

    await sleep(1500);

    editor = vscode.window.activeTextEditor;

    if (!editor) {
      return;
    }

    console.log(editor.document.getText());

    let fromPosition = {
      row: editor.selection.active.line,
      col: editor.selection.active.character,
    };

    let toPosition = { row: 17, col: 43 };

    await handleMoveCursor(editor, fromPosition, toPosition);

    text = `
    <script src="./test.js"></script>`;

    await handleInput(editor, text, fromPosition.row, fromPosition.col);

    roundRobin();
  };

  function roundRobin() {
    let key = 0;
    let timer = setInterval(async () => {
      console.log('setInterval');

      key = key + 1;
      const {
        data: { order },
      } = await axios.get(`http://127.0.0.1:4001/query?key=${key}`);

      if (order.length > 0) {
        clearInterval(timer);
        exec();
      }
    }, constant.REQUEST_INTERVAL);
  }

  roundRobin();

  let disposable = vscode.commands.registerCommand('tutolang-vscode-extension.codeDemo', async () => {
    vscode.window.showInformationMessage(`Hello, I'm Oreo!`);
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
