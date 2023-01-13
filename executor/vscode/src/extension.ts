import * as vscode from 'vscode';
import axios from 'axios';

const sleep = (delay = 90) => new Promise(resolve => setTimeout(resolve, delay));

const handleInputOneWord = (
  editor: vscode.TextEditor | undefined,
  word: string,
  startRow: number,
  startCol: number
) => {
  if (!editor) {
    return;
  }

  return new Promise(async resolve => {
    await sleep();
    await editor.edit(editBuilder => {
      editBuilder.insert(new vscode.Position(startRow, startCol), word);
    });
    resolve('Completed Input a word');
  });
};

const handleInput = async (editor: vscode.TextEditor | undefined, text: string, startRow: number, startCol: number) => {
  if (!editor) {
    return;
  }
  return new Promise(async resolve => {
    let curRow = startRow;
    let curCol = startCol;
    for (let i = 0; i < text.length; i++) {
      await handleInputOneWord(editor, text[i], curRow, curCol);
      if (text[i] === '\n') {
        curRow = curRow + 1;
      }
      curCol = curCol + 1;
    }
    resolve('Completed Input Task');
  });
};

const handleMoveCursor = (editor: vscode.TextEditor | undefined, fromPosition: number[], toPosition: number[]) => {
  if (!editor) {
    return;
  }

  return new Promise(async resolve => {
    while (fromPosition[0] < toPosition[0]) {
      fromPosition[0] = Number(fromPosition[0]) + 1;
      await sleep();
      editor.selection = new vscode.Selection(
        new vscode.Position(fromPosition[0], fromPosition[1]),
        new vscode.Position(fromPosition[0], fromPosition[1])
      );
    }

    while (fromPosition[0] > toPosition[0]) {
      fromPosition[0] = Number(fromPosition[0]) - 1;
      await sleep();
      editor.selection = new vscode.Selection(
        new vscode.Position(fromPosition[0], fromPosition[1]),
        new vscode.Position(fromPosition[0], fromPosition[1])
      );
    }

    while (fromPosition[1] < toPosition[1]) {
      fromPosition[1] = Number(fromPosition[1]) + 1;
      await sleep();
      editor.selection = new vscode.Selection(
        new vscode.Position(fromPosition[0], fromPosition[1]),
        new vscode.Position(fromPosition[0], fromPosition[1])
      );
    }

    while (fromPosition[1] > toPosition[1]) {
      fromPosition[1] = Number(fromPosition[1]) - 1;
      await sleep();
      editor.selection = new vscode.Selection(
        new vscode.Position(fromPosition[0], fromPosition[1]),
        new vscode.Position(fromPosition[0], fromPosition[1])
      );
    }

    resolve('Completed MoveCursor Task');
  });
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

    let fromPosition = [editor.selection.active.line, editor.selection.active.character];
    let toPosition = [17, 43];

    await handleMoveCursor(editor, fromPosition, toPosition);

    text = `
    <script src="./test.js"></script>`;

    await handleInput(editor, text, fromPosition[0], fromPosition[1]);
  };

  let key = 0;
  setInterval(async () => {
    key = key + 1;
    const {
      data: { code },
    } = await axios.get(`http://127.0.0.1:4001/query?key=${key}`);

    if (code === 200) {
      exec();
    }
  }, 5000);

  let disposable = vscode.commands.registerCommand('tutolang-vscode-extension.codeDemo', async () => {
    vscode.window.showInformationMessage(`Hello, I'm Oreo!`);
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
