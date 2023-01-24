const http = require('http');

const server = http.createServer();

const emptyResponseData = { commands: [] };

const responseData = {
  commands: [
    {
      type: 'OpenFile',
      filePath: './test.js',
      openFileOptions: {
        selectRange: {
          startPosition: { row: 10, col: 8 },
          endPosition: { row: 10, col: 27 },
        },
        preview: false,
        viewColumn: 1,
      },
    },
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
    {
      type: 'OpenFile',
      filePath: './test.html',
      openFileOptions: {
        selectRange: {
          startPosition: { row: 10, col: 8 },
          endPosition: { row: 10, col: 27 },
        },
        preview: true,
        viewColumn: 2,
      },
    },
    { type: 'MoveCursor', toPosition: { row: 17, col: 43 } },
    {
      type: 'Input',
      content: `
    <script src="./test.js"></script>`,
      position: { row: 17, col: 43 },
    },
  ],
};

server.on('request', function (req, res) {
  console.log(req.url);
  if (req.url.includes('/query')) {
    if (req.url.includes('key=3')) {
      res.end(JSON.stringify(responseData));
    } else {
      res.end(JSON.stringify(emptyResponseData));
    }
  }
});

server.listen(4001, function () {
  console.log('Server is running...');
});
