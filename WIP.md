# WIP

## 项目目标
- 通过 `.tutolang` 脚本将代码仓库的提交历史转换成带解说的编程教程视频：解析脚本 → 编译为可执行 TS → 运行时驱动录屏与 TTS → 合成视频。

## 目录速记
- `packages/`：核心实现（types、parser、compiler、plugin-system、runtime、core、cli、config、utils）。
- `executor/`：录制执行器（VSCode 已有骨架，其余待建）。
- `docs/`：`architecture.md`、`project-structure.md` 等架构与结构说明。
- `sample/`：示例脚本 `hello-world.tutolang` 和 `vue3/`。
- 根部文档：`README.md`（使用说明）、`Reference.md`（语法参考）、`Roadmap.md`、`TODO.md`、`AGENTS.md`（AI 写作与协作规范）。

## 当前进度（截至 2025-12-17）
- **已完成**：架构与目录文档；类型定义（AST/Executor/Plugin/RuntimeConfig）；包与 CLI/Runtime/Executor/Plugin 管理器骨架；VSCode 执行器骨架；示例脚本；零转译改造（Node 24 LTS，原生 `node --test --experimental-strip-types --experimental-transform-types`，移除 Jest/ts-node，mock runner/测试均为 TS）。
- **未实现/空白**：Lexer/完整 Parser/CodeGenerator/Compiler 主流程；Runtime 各功能（TTS、录屏、合成、Git）；PluginManager 钩子调用细节；CLI 的 compile/execute 逻辑；config/utils 内容；执行器的真实交互与录屏。

## 进展速记（2025-12-17 夜间）
- mock 模式：`pnpm mock-sample`/`--mock` 输出语义化动作列表，支持 `--mockFormat json|text|both`。
- Parser MVP：行级解析支持 say/file/browser/commit/video，marker 支持 start/end/lN/edit/hl/click；忽略行注释与块注释。
- 测试：Node 原生测试覆盖 parser 与 mock e2e；路径别名 `@tutolang/*` 在 tsconfig 生效。
- 编译闭环：CodeGenerator+Runtime+CLI execute 已可输出首个占位视频 `dist/hello-world.mp4`（ffmpeg 文字叠加）。

## 当前任务（2025-12-18）
- 目标：推动 Parser → Compiler → Runtime 的 MVP 闭环。
- TODO：
  - [x] 完整化 Parser（基础增强：字符串字面量、严格缩进块、错误定位提示、参数解析健壮性；后续补充 Lexer 级细化）。
  - [x] 设计并实现 CodeGenerator 的输出结构（调用 Runtime 的 TS 代码骨架）。
  - [x] 串联 Compiler pipeline（调用插件钩子 + Parser + CodeGenerator，提供 compile-only 输出）。
  - [x] Runtime MVP：提供 say/file/browser/video/merge 的 stub，实现日志化输出，便于 e2e。
  - [x] CLI：打通 `compileFile/executeFile` 的输入/输出路径（写入生成的 TS 并可直接执行）。

## 本次整理（2025-12-18 工程与文档）
- 目标：让「VSCode 录屏 + 配置 + CLI」更容易跑通，并清理工程质量问题（大文件/缺测试/文档缺口）。
- TODO：
  - [x] 增加录屏参数模板文档：`docs/recording.md`（macOS avfoundation 示例）。
  - [x] 增加配置模板与一键生成：`docs/templates/*` + `pnpm init-config`。
  - [x] 拆分 `packages/runtime/index.ts`（避免单文件过大）。
  - [x] 拆分 Runtime 单测（避免单文件过大）。
  - [x] 补齐 CLI 配置加载与执行器工厂单测（`packages/cli/__tests__/*`）。
  - [x] 补齐常规文档：`TESTING.md` / `DEV_NOTE.md`。

## 本次任务（2025-12-17）
- 目标：落地 Runtime 的 TTS 能力，集成 Gemini-2.5-flash-preview-tts，生成可用语音片段并与视频片段衔接。
- TODO：
  - [x] 梳理 Gemini TTS 接口与鉴权方式，确定默认配置（模型、地区、鉴权、编码）。
  - [x] 实现可配置的 TTS 客户端（HTTP 请求、错误处理、音频落盘）。
  - [x] 将 `runtime.say` 接入 TTS，生成包含语音的片段并参与 `merge`。
  - [x] 补充单测（TTS 请求构造/落盘）与使用提示。

## 本次修复（2025-12-17）
- 目标：修复示例视频生成失败，并将所有 AI 调用结果做磁盘缓存以节省成本。
- TODO：
  - [x] 修复 `Runtime.createSlide` 的 ffmpeg 参数顺序（`-vf` 误绑定到音频输入导致报错）。
  - [x] 修复合成后音画不同步：无 TTS 的片段注入静音音轨，并将音轨补齐到片段时长。
  - [x] 为 TTS 增加磁盘缓存（默认 `.tutolang-cache/tts/`，可配置覆盖）。
  - [x] 预留通用 AI 请求缓存工具（后续文本/图像等调用复用）。
  - [x] 补充单测：TTS 缓存命中不再发起请求；视频生成参数顺序回归（尽量不依赖本机 ffmpeg）。

## 本次修复（2025-12-17 逐行解说语音）
- 目标：文件区块逐行解说（`[lN]`/`[edit]`）也生成语音，并合成进最终视频。
- TODO：
  - [x] `Runtime.inputLine`/`Runtime.editLine` 在 `renderVideo=true` 时生成对应语音片段。
  - [x] 补充单测：逐行解说应将音频路径传入 `createSlide`。

## 下一步（2025-12-17 文件代码预览）
- 目标：在 `file/inputLine/editLine/fileEnd` 的视频片段里展示真实文件内容（若可读取），并高亮当前行，提升「像在写代码」的观感。
- TODO：
  - [x] `RuntimeConfig` 增加 `projectDir`（脚本所在目录），用于解析脚本内相对路径（如 `index.html`）。
  - [x] `Runtime.file` 读取文件内容并输出代码预览 slide（含行号）。
  - [x] `Runtime.inputLine/editLine` 若已打开文件则渲染代码预览：`mode=i` 按 marker 行号渐进展示、并高亮目标行。
  - [x] `Core.executeFile` 自动注入 `projectDir=dirname(inputPath)`。
  - [x] 单测：`file + inputLine` 应输出包含源码行的 slide 文本，并携带 `layout=code`。
  - [x] 补齐 `sample/index.html`，让 `sample/hello-world.tutolang` 可直接展示代码。

## 下一步（2025-12-17 VSCode 自动输入与录屏 MVP）
- 目标：实现 `file(i)` 对应的「控制 VSCode 输入代码并录屏」能力，作为后续真实视频产出的基础。
- 结论速记：
  - VSCode 扩展 API 可稳定完成「打开文件/写入文本/移动光标/高亮」。
  - VSCode 本身不提供官方的「屏幕录制」API；录屏仍需要外部工具（如 ffmpeg），由 Executor 侧编排启动/停止。
- TODO：
  - [x] 扩展侧：启动本地 RPC 服务（localhost），提供 open/type/move/highlight 等接口（不再轮询外部 server）。
  - [x] Node 侧：实现 `VSCodeExecutor` 客户端（实现 `CodeExecutor`），通过 RPC 驱动扩展。
  - [x] 录屏：实现基于 ffmpeg 的 `startRecording/stopRecording`（参数由配置注入，先支持录全屏/用户自配）。
  - [x] Demo：提供最小可运行脚本（打开 sample/index.html 并逐行输入），便于人工验收。
  - [x] 文档：补齐 `executor/vscode/README.md` 的配置与运行步骤（如何启动扩展、如何跑 demo、如何录屏）。

## 下一步（2025-12-17 将 VSCode 录制接入 Runtime：实现 file(i) 真视频片段）
> 你重启 session 后，从这里继续即可。

### 目标
- `file(i)` 不再用 `createSlide` 产出占位画面，而是：
  - 驱动 VSCode 打开/清空目标文件；
  - 按脚本推进逐行输入（包含补齐 marker 之间未标注的行）；
  - 按每个 marker 生成一个「真实录屏片段」并嵌入对应 TTS 音轨；
  - 最终由 `Runtime.merge` 合并为完整视频。

### 设计约束（关键）
- **统一编码参数**：为了让 `merge` 继续使用 concat + `-c copy`，所有片段必须统一：分辨率、fps、视频编码（H.264）、像素格式（yuv420p）、音频编码（AAC mono）、采样率（默认 24000）。
- **录屏不依赖 VSCode API**：VSCode 扩展只管编辑器动作；录屏由 Node 侧 ffmpeg 控制（参数模板由用户配置）。
- **片段级对齐**：每个 marker 生成一个 segment，并在生成时把 TTS 音频“烘焙”进 segment（避免后续复杂的音轨对齐/混音）。

### TODO（按推荐顺序）
- [x] `Runtime` 增加 “录屏片段” 产出路径：
  - [x] 当 `renderVideo=true` 且设置了 `codeExecutor` 且 `file.mode === 'i'`：
    - [x] `Runtime.file`：调用 `codeExecutor.openFile(path, { createIfMissing: true, clear: true })`；初始化 `typedLineCount=0`。
    - [x] `Runtime.inputLine`：把本次 marker 当作一个 segment：
      - [x] 预先生成本条解说的 TTS（命中缓存后很快），拿到 `audioDuration`，计算 `desiredDuration = max(minDuration, audioDuration + 0.2)`；
      - [x] `codeExecutor.startRecording()`；
      - [x] 从 `typedLineCount + 1` 逐行输入到 `lineNumber`（补齐中间未标注行），输入内容来自真实文件行（`Runtime.file` 已读取）；
      - [x] `codeExecutor.highlightLine(lineNumber)`；
      - [x] 为了保证视频长度覆盖解说：输入完后 `sleep(remainingMs)` 再 `stopRecording()`；
      - [x] 使用 ffmpeg 将 raw 录屏转码为「标准 segment」并把音轨合成进去（或注入静音），然后 push 到 `videoSegments`。
    - [x] `Runtime.fileEnd`：可选补齐剩余未输入行（无解说，静音短片段即可），保证最终文件完整。
- [x] `Runtime.merge` 的健壮性检查：
  - [x] 若发现 segment 编码参数不一致，明确报错并提示“录屏模板需统一参数/或启用转码合并”。
- [x] 配置与接线（MVP 先不做 CLI 参数也行）：
  - [x] 新增脚本：编译并运行 `sample/hello-world.tutolang`，运行前注入 `runtime.setCodeExecutor(new VSCodeExecutor(...))`；
  - [x] 升级为 CLI 配置项（支持 `--config`、默认搜索 `tutolang.config.*` 与 `~/tutolang/config.*`）。
  - [x] 增加配置模板与一键生成脚本：`docs/templates/*` + `pnpm init-config`。
- [x] 测试（不依赖真实 VSCode/ffmpeg）：
  - [x] fake `CodeExecutor`：断言 `openFile/typed lines/highlight/startRecording/stopRecording` 调用序列正确；
  - [x] fake ffmpeg：捕获 “raw->segment 转码 + 音频注入” 的参数（类似 `packages/runtime/__tests__/runtime.spec.ts` 的做法）。
- [x] 手工验收步骤（写到文档里）：
  - [x] 启动 Extension Host；
  - [x] 设置好 `TUTOLANG_RECORD_ARGS_JSON`（包含 `{output}`）；
  - [x] 运行 demo / 运行 sample，确认生成 mp4 能播放、片段能合并、音画时长合理。

## 下一步（2025-12-18 浏览器预览 MVP）
- 目标：让 `browser` 区块能产出「真实页面画面」，先用截图生成视频片段（MVP），后续再补浏览器录屏。
- TODO：
  - [ ] Runtime：支持 “图片/截图” 片段（基于 ffmpeg 将图片转成标准 segment），并让 `browser()/click()/highlight()` 在有 `browserExecutor` 时用截图代替文字 slide。
  - [ ] CLI：支持 `executors.browser` 配置与工厂创建（类似 `executors.code`），并注入 Core/Runtime。
  - [ ] executor/browser：实现 PuppeteerExecutor 的基础能力（launch/newPage/navigate/click/type/highlight/screenshot）。
  - [ ] 测试：补齐 Runtime/CLI 的单测（不依赖真实浏览器/ffmpeg）。
  - [ ] 文档：补配置与使用说明（安装依赖、常见坑、示例脚本）。

## 下一步（2025-12-18 浏览器内部录制）
- 目标：浏览器执行器支持“浏览器内部录制”（CDP screencast → ffmpeg 编码），让 `browser` 区块可以生成真实动态画面（不依赖系统录屏）。
- TODO：
  - [ ] executor/browser：实现 `startRecording/stopRecording`（CDP `Page.startScreencast` 拉帧，落盘为序列帧后用 ffmpeg 编码为 mp4）。
  - [ ] Runtime：在 `say(browser)`/`[click]`/`[highlight]` 场景优先走录制片段（失败时降级截图），并将解说音轨烘焙进 segment。
  - [ ] Compiler：浏览器块内的 marker 生成合并后的调用（例如 `highlight(selector, narration)`，`say(..., { browser: 'true' })`），避免“动作/解说”拆成两个片段。
  - [ ] 测试：覆盖“录制路径/降级路径”的参数拼装与时长逻辑（不依赖真实 puppeteer/ffmpeg）。
  - [ ] 文档：补配置项（录制 fps、输出目录、ffmpeg 路径）与使用步骤。

## 近期优先事项（建议）
1. **Parser 落地**：补全词法/语法规则（关键字、字符串、缩进、注释、标记行），用 `sample/hello-world.tutolang` 写单测驱动。
2. **AST 与生成**：根据 `@tutolang/types` 扩充必要字段（如 marker 参数/类型），实现 CodeGenerator 输出调用 Runtime 的 TS 代码。
3. **Compiler 流水线**：串起插件钩子、解析与代码生成，提供 compile-only 产物（便于调试）。
4. **Runtime MVP（可先 mock）**：实现 `say/file/browser/video/merge` 的最小闭环，允许用日志/假视频路径先跑通。
5. **多分辨率/多语言输出策略**：设计 Runtime/CodeGenerator 接口，支持一次编译生成多分辨率、响应式布局的产出（帧率/字幕格式暂不优先）。
6. **CLI 行为**：实现 `compileFile` 与 `executeFile`，支持 `-i/-o/-c/-v`，能读取单文件编译并落地到输出目录。
7. **测试与示例**：为 parser、compiler、runtime 写基础单测；补一份更贴近真实流程的示例仓库脚本。

## 已确认决策（2025-12-16）
- TTS：使用最新的 **Gemini-2.5-flash-preview-tts**。
- 录屏：首选 **ffmpeg** 或其它可命令行控制的开源工具。
- 执行器讨论：等 MVP mock 跑通后再确定优先级（当前可保持 VSCode 骨架，先不深入）。
- 视频产出目标：主打响应式布局，一次性输出所有需要的分辨率与语言；帧率与字幕格式暂不关键。
- Git 工作流：若 commit 粒度限制过严，可采用 tag 为主，保持灵活（不强制一场景一 commit）。
