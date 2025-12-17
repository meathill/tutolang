# tutolang

A script for making Programing Tutorial videos.

运行环境
--------

- Node.js 24 LTS（使用 `--experimental-strip-types --experimental-transform-types` 原生执行 TypeScript）。
- 无需 Babel/ts-node/ts-jest，保持零转译、纯 ESM。


Synopsis
--------

```bash
# install this as global tools
npm i tutolang -g
tutolang -v
v0.1.0

# generate a video from a git repo
tutolang -i ./repo -o ./dist
```


How to use
--------

1. Create a repo
2. Write down application codes as usual
3. Then we start to create tutorial
   4Add `index.tutolang` to the root, like:
    ```tutolang
    # we could add
    say(image=/path/to/cover):
        hello, every one, I'm Meathill.
        In this lesson, I will teach you how to write HTML, CSS, and JavaScript.

    file 'index.html':
        [start] Let's make a simple html as example.
        [l1] `doctype html` will tell browser this is page will follow HTML5 specification.
        [l5] `div` is a container we will use it many times to create full page layout

    say:
        now you can see a very simple "hello world" in browser window

    file 'style.css':
        [start] Then let's add some styles to this page.
        [l5] `color red` will make the color of font to red.

    say:
        OK, you see,
    ```
4. Commit all codes
5. Write next scene
6. Add video script to this scene, like:
    ```tutolang
    file 'style.css':
        [start] the default red is a little ugly, let's make it better
        [diff5] `#369` is a hex number

    say:
        better, yes?
    ```
7. Commit all changes
8. Write next scene till all scenes are written.
9. Generate video via `tutolang -i ./repo -o ./dist`
10. Then you can find the video under `./dist`

Mock mode
---------

快速验证脚本、不触发 TTS/录屏（零转译，直接用 Node.js 24 跑 `.ts`）：

```bash
pnpm mock-sample
# 或直接跑 CLI
node --experimental-strip-types --experimental-transform-types packages/cli/index.ts -i sample/hello-world.tutolang --mock --mockFormat both
```

控制台会输出按脚本顺序的语义化动作列表，可选同时输出 JSON。


Reference# tutolang

A script for making Programing Tutorial videos.


Synopsis
--------

```bash
# install this as global tools
npm i tutolang -g
tutolang -v
v0.1.0

# generate a video from a git repo
tutolang -i ./repo -o ./dist
```


How to use
--------

1. Create a repo
2. Write down application codes as usual
3. Then we start to create tutorial. Add `index.tutolang` to the root, like:
    ```tutolang
    # we could use these code to generate video with commentary
    say(image=/path/to/cover):
        hello, every one, I'm Meathill.
        In this lesson, I will teach you how to write HTML, CSS, and JavaScript.
   
    # then we could create input video from an exist file.
    # here `i` means all content should be input automatically
    file(i) 'index.html':
        [say] Let's make a simple html as example.
        # `l1` means this text should be read out in the first line of input.
        [l1] `doctype html` will tell browser this is page will follow HTML5 specification.
        [l5] `div` is a container we will use it many times to create full page layout

    # `browser` means this video should be recorded from browser
    say(browser):
        now you can see a very simple "hello world" in browser window

    # another input video 
    file(i) 'style.css':
        [say] Then let's add some styles to this page.
        [l5] `color red` will make the color of font to red.

    # just `say`, we should stay at last screen, until the speech finished 
    say:
        OK, you see,
    ```
4. Commit all codes
5. Write next scene
6. Add video script to this scene, like:
    ```tutolang
    # `e` = edit from previous commit
    file(e) 'style.css':
        [say] the default red is a little ugly, let's make it better
        # use new content from row 5, column 7, replace old one
        [edit 5] `#369` is a hex number

    say:
        better, yes?
    ```
7. Commit all changes
8. Write next scene till all scenes were written.
9. Generate video via `tutolang -i ./repo -o ./dist`
10. Then you can find the video under `./dist`


Documentation
-----------

[Reference](./Reference.md)


Roadmap
-------

[Roadmap](./Roadmap.md)


Usage
--------

### Configuration

You can put a config JS file at `~/tutolang/config.js` or `{CWD}/tutolang.config.js` to set the configuration:

```js
module.exports = {
  tts: {

  },
  ffmpeg: '',
}
```

Prerequisites
--------

### node.js

>= 18.x

### puppeteer

### ffmpeg


License
---------

[MIT](https://opensource.org/licenses/MIT)
