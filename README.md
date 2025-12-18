# tutolang

一款将代码历史与解说脚本转成教学视频的工具（零转译、纯 ESM）。

## 运行环境

- Node.js >= 24（本仓库默认用 `node --experimental-strip-types --experimental-transform-types` 原生执行 TypeScript）
- 本机可执行 `ffmpeg` / `ffprobe`
- 可选：Gemini TTS（设置 `GOOGLE_API_KEY`，否则会自动降级为静音解说）
- 可选：VSCode 录屏（启动 `executor/vscode` 的 Extension Host，并配置录屏参数模板）

## 快速开始（开发态）

```bash
pnpm mock-sample
# 或直接跑 CLI
node --experimental-strip-types --experimental-transform-types packages/cli/index.ts -i sample/hello-world.tutolang --mock --mockFormat both

# 生成视频（不启用 VSCode 执行器时会走“代码预览 slide”路径）
node --experimental-strip-types --experimental-transform-types packages/cli/index.ts -i sample/hello-world.tutolang -o dist
```

## 如何使用

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
4. 运行 CLI 生成视频（开发态示例）：

    ```bash
    node --experimental-strip-types --experimental-transform-types packages/cli/index.ts -i ./repo/index.tutolang -o ./dist
    ```
5. 视频产物位于 `./dist`。

## Mock 模式

快速验证脚本、不触发 TTS/录屏（零转译，直接用 Node.js 24 跑 `.ts`）：

```bash
pnpm mock-sample
# 或直接跑 CLI
node --experimental-strip-types --experimental-transform-types packages/cli/index.ts -i sample/hello-world.tutolang --mock --mockFormat both
```

控制台会输出按脚本顺序的语义化动作列表，可选同时输出 JSON。

## 配置

配置文件支持 `--config <path>`，未传入时会自动查找：

- `{CWD}/tutolang.config.{ts,js,mjs,cjs,json}`
- `~/tutolang/config.{ts,js,mjs,cjs,json}`

配置支持 runtime 设置（如 `tts`/`ffmpeg`/`cacheDir`），以及（可选）executors（如 VSCode 录屏）。

#### 生成配置模板

仓库内置了两份模板：

- 最小可用：`docs/templates/tutolang.config.minimal.ts`
- VSCode 录屏：`docs/templates/tutolang.config.vscode.ts`

一键生成到当前目录（生成 `./tutolang.config.ts`）：

```bash
pnpm init-config
# VSCode 录屏版
pnpm init-config -- --template vscode
```

你也可以生成到全局配置位置（便于所有项目复用）：

```bash
pnpm init-config -- --home
```

CommonJS 配置请命名为 `tutolang.config.cjs` 并使用 `module.exports = { ... }`。

> TTS 配置说明（Gemini-2.5-flash-preview-tts + `@google/genai`）：
> - 提供 `GOOGLE_API_KEY`（官方 Gemini API Key），否则会跳过语音生成仅输出文字画面。
> - 可覆盖字段：`tts.model`（默认 `gemini-2.5-flash-preview-tts`）、`tts.voiceName`（默认 `Puck`）、`tts.sampleRateHertz`（默认 24000）。  
> - AI 调用（如 TTS）默认会做磁盘缓存，目录为 `{CWD}/.tutolang-cache/`；可通过 `TUTOLANG_CACHE_DIR` 或配置项 `cacheDir` / `tts.cacheDir` 覆盖。
> - 需要本地安装 `ffmpeg`/`ffprobe`；如路径不同，可通过 `ffmpeg.path` 与 `ffmpeg.ffprobePath` 覆盖。

#### VSCode 录屏说明（简要）

启用 VSCode 录屏执行器后（`executors.code.type = "vscode"`），还需要提供录屏参数模板（二选一）：

- `executors.code.recording.argsTemplate`
- 或环境变量 `TUTOLANG_RECORD_ARGS_JSON`（JSON 字符串数组，必须包含 `{output}` 占位符）

更完整的步骤与注意事项见 `executor/vscode/README.md`。
录屏参数模板示例见 `docs/recording.md`（包含 macOS avfoundation 示例）。

## 文档

- `Reference.md`：语法参考（目前为英文）
- `docs/architecture.md`：架构设计
- `docs/project-structure.md`：目录结构
- `executor/vscode/README.md`：VSCode 扩展与录屏说明
- `docs/recording.md`：ffmpeg 录屏参数模板（macOS 示例）
- `TESTING.md`：测试指南
- `DEV_NOTE.md`：开发环境与常见坑

## License

MIT
