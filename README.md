# tutolang

一款将代码历史与解说脚本转成教学视频的工具（零转译、纯 ESM）。

运行环境
--------

- Node.js 24 LTS（使用 `--experimental-strip-types --experimental-transform-types` 原生执行 TypeScript）
- 无需 Babel/ts-node/ts-jest，保持零转译


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
----------

1. 准备好代码仓库。
2. 在仓库根目录创建 `index.tutolang`，示例：

    ```tutolang
    # 简单示例
    say(image=/path/to/cover):
        hello, everyone. In this lesson we will write HTML, CSS, and JavaScript.

    file(i) 'index.html':
        [start] Let's make a simple html as example.
        [l1] `doctype html` tells browser we follow HTML5.
        [l5] `div` is a container we will use for layout.

    say:
        now you can see a simple "hello world" in browser window

    file(e) 'style.css':
        [start] Let's add some styles.
        [l5] `color: red` will change font color.
    ```
3. 持续补充后续场景，按需加入 `commit`、`browser`、`video` 等指令。
4. 运行 `tutolang -i ./repo -o ./dist` 生成视频。
5. 视频产物位于 `./dist`。

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

> TTS 配置说明（Gemini-2.5-flash-preview-tts + `@google/genai`）：
> - 提供 `GOOGLE_API_KEY`（官方 Gemini API Key），否则会跳过语音生成仅输出文字画面。
> - 可覆盖字段：`tts.model`（默认 `gemini-2.5-flash-preview-tts`）、`tts.voiceName`（默认 `Puck`）、`tts.sampleRateHertz`（默认 24000）。  
> - AI 调用（如 TTS）默认会做磁盘缓存，目录为 `{CWD}/.tutolang-cache/`；可通过 `TUTOLANG_CACHE_DIR` 或配置项 `cacheDir` / `tts.cacheDir` 覆盖。
> - 需要本地安装 `ffmpeg`/`ffprobe`；如路径不同，可通过 `ffmpeg.path` 与 `ffmpeg.ffprobePath` 覆盖。

Prerequisites
--------

### node.js

>= 18.x

### puppeteer

### ffmpeg


License
---------

[MIT](https://opensource.org/licenses/MIT)
