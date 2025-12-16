import { runMockFromFile } from '@tutolang/core/mock';

describe('CLI mock output (hello-world)', () => {
  test('should produce human-readable action list', async () => {
    const output = await runMockFromFile('sample/hello-world.tutolang');
    expect(output).toMatchInlineSnapshot(`
"1. 语音播报：Hello, everyone! Welcome to this tutorial. In this video, I'll show you how to create a simple web page.
2. 打开文件：index.html（模式：输入 i）
3. 语音播报：Let's create our HTML file.
4. 输入行 1：First, we declare the doctype.
5. 输入行 2：Then we open the html tag.
6. 输入行 5：The body tag will contain our content.
7. 输入行 6：A simple heading.
8. 语音播报：That's it for the HTML structure!
9. 文件讲解结束：index.html
10. 语音播报：Now let's see how it looks in the browser.
11. 打开浏览器，加载：index.html
12. 语音播报：Here's our page!
13. 高亮元素：h1
14. 语音播报：This is our heading.
15. 语音播报：Simple and clean!
16. 浏览器讲解结束：index.html
17. 打开文件：index.html（模式：编辑 e）
18. 语音播报：Let's add some style to make it look better.
19. 编辑行 6：We'll change the heading text.
20. 文件讲解结束：index.html
21. 打开浏览器，加载：index.html
22. 语音播报：Much better now!
23. 语音播报：That's all for this tutorial. Thanks for watching!
24. 浏览器讲解结束：index.html
25. 语音播报：Don't forget to like and subscribe!"
`);
  });
});
