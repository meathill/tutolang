const vscode = require('vscode')

function sleep(delay) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve()
    }, delay)
  })
}

function activate(context) {
  console.log('Congratulations, your extension "tutolang-vscode-extension" is now active!')

  let disposable = vscode.commands.registerCommand('tutolang-vscode-extension.fetchInputTxt', async function () {
    vscode.window.showInformationMessage('Hello, 你好, 我是奥利奥')

    const editer = vscode.window.activeTextEditor

    if (!editer) {
      return
    }

    let text = `// 下面我将教你如何在JavaScript中定义一个函数
function A() {
	let a = 1;
	return a;
}`

    let row = 1
    let col = 0
    for (let i = 0; i < text.length; i++) {
      if (text[i] == '\n') {
        row = row + 1
      }
      col = col + 1
      await sleep(30)

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
    let toPosition = [17, 37]
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
  })

  context.subscriptions.push(disposable)
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
}
