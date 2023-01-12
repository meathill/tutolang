import * as vscode from 'vscode'

const sleep = (delay: number) => new Promise(resolve => setTimeout(resolve, delay))

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "tutolang-vscode-extension" is now active!')

  const exec = async () => {
    const editer = vscode.window.activeTextEditor

    if (!editer) {
      return
    }

    let text = `// (语音) JavaScript 函数是被设计为执行特定任务的代码块。
// (语音) JavaScript 函数会在某代码调用它时被执行。

// 下面我将教你如何在JavaScript中定义一个函数
function A() {
	let a = 1;
	return a;
}

// 下面我们去 HTML文件 中通过<script>脚本的形式引入我们刚刚写的函数`

    let row = 1
    let col = 0
    for (let i = 0; i < text.length; i++) {
      if (text[i] == '\n') {
        row = row + 1
      }
      col = col + 1
      await sleep(50)

      editer.edit(editBuilder => {
        editBuilder.insert(new vscode.Position(row, col), text[i])
      })
    }

    await sleep(1000)

    vscode.window.showInputBox({
      value: 'test.html',
    })

    await sleep(1000)

    const path = '/Users/oreo/workspace/html/test.html'
    const options = {
      selection: new vscode.Range(new vscode.Position(10, 8), new vscode.Position(10, 27)),
      preview: false,
      viewColumn: vscode.ViewColumn.One,
    }

    await vscode.window.showTextDocument(vscode.Uri.file(path), options)

    await sleep(1000)

    let newEditor = vscode.window.activeTextEditor

    if (!newEditor) {
      return
    }

    let fromPosition = [newEditor.selection.active.line, newEditor.selection.active.character]
    let toPosition = [17, 43]
    while (fromPosition[0] < toPosition[0]) {
      fromPosition[0] = Number(fromPosition[0]) + 1
      await sleep(200)
      newEditor.selection = new vscode.Selection(
        new vscode.Position(fromPosition[0], fromPosition[1]),
        new vscode.Position(fromPosition[0], fromPosition[1])
      )
    }
    // const code = newEditor.document.getText()
    newEditor.selection = new vscode.Selection(new vscode.Position(17, 37), new vscode.Position(17, 37))
    fromPosition = [17, 37]

    while (fromPosition[1] < toPosition[1]) {
      fromPosition[1] = Number(fromPosition[1]) + 1
      await sleep(200)
      newEditor.selection = new vscode.Selection(
        new vscode.Position(fromPosition[0], fromPosition[1]),
        new vscode.Position(fromPosition[0], fromPosition[1])
      )
    }

    let insertCode = `
    <script src="./test.js"></script>`

    row = fromPosition[0]
    col = fromPosition[1]
    for (let i = 0; i < insertCode.length; i++) {
      if (insertCode[i] == '\n') {
        row = row + 1
        col = 0
      } else {
        col = col + 1
      }

      await sleep(50)

      newEditor.edit(editBuilder => {
        editBuilder.insert(new vscode.Position(row, col), insertCode[i])
      })
    }
  }

  exec()

  let disposable = vscode.commands.registerCommand('tutolang-vscode-extension.codeDemo', async () => {
    vscode.window.showInformationMessage(`Hello, I'm Oreo!`)

    const editer = vscode.window.activeTextEditor

    if (!editer) {
      return
    }

    let text = `// (语音) JavaScript 函数是被设计为执行特定任务的代码块。
// (语音) JavaScript 函数会在某代码调用它时被执行。

// 下面我将教你如何在JavaScript中定义一个函数
function A() {
	let a = 1;
	return a;
}

// 下面我们去 HTML文件 中通过<script>脚本的形式引入我们刚刚写的函数`

    let row = 1
    let col = 0
    for (let i = 0; i < text.length; i++) {
      if (text[i] == '\n') {
        row = row + 1
      }
      col = col + 1
      await sleep(40)

      editer.edit(editBuilder => {
        editBuilder.insert(new vscode.Position(row, col), text[i])
      })
    }

    await sleep(1000)

    vscode.window.showInputBox({
      value: 'test.html',
    })

    await sleep(1000)

    const path = '/Users/oreo/workspace/html/test.html'
    const options = {
      selection: new vscode.Range(new vscode.Position(10, 8), new vscode.Position(10, 27)),
      preview: false,
      viewColumn: vscode.ViewColumn.One,
    }

    await vscode.window.showTextDocument(vscode.Uri.file(path), options)

    await sleep(1000)

    let newEditor = vscode.window.activeTextEditor

    if (!newEditor) {
      return
    }

    let fromPosition = [newEditor.selection.active.line, newEditor.selection.active.character]
    let toPosition = [17, 43]
    while (fromPosition[0] < toPosition[0]) {
      fromPosition[0] = Number(fromPosition[0]) + 1
      await sleep(200)
      newEditor.selection = new vscode.Selection(
        new vscode.Position(fromPosition[0], fromPosition[1]),
        new vscode.Position(fromPosition[0], fromPosition[1])
      )
    }
    // const code = newEditor.document.getText()
    newEditor.selection = new vscode.Selection(new vscode.Position(17, 37), new vscode.Position(17, 37))
    fromPosition = [17, 37]

    while (fromPosition[1] < toPosition[1]) {
      fromPosition[1] = Number(fromPosition[1]) + 1
      await sleep(200)
      newEditor.selection = new vscode.Selection(
        new vscode.Position(fromPosition[0], fromPosition[1]),
        new vscode.Position(fromPosition[0], fromPosition[1])
      )
    }

    let insertCode = `
    <script src="./test.js"></script>`

    row = fromPosition[0]
    col = fromPosition[1]
    for (let i = 0; i < insertCode.length; i++) {
      if (insertCode[i] == '\n') {
        row = row + 1
        col = 0
      } else {
        col = col + 1
      }

      await sleep(40)

      newEditor.edit(editBuilder => {
        editBuilder.insert(new vscode.Position(row, col), insertCode[i])
      })
    }
  })

  context.subscriptions.push(disposable)
}

export function deactivate() {}
