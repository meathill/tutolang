# WIP

## 项目目标
- 通过 `.tutolang` 脚本将代码仓库的提交历史转换成带解说的编程教程视频：解析脚本 → 编译为可执行 TS → 运行时驱动录屏与 TTS → 合成视频。

## 目录速记
- `packages/`：核心实现（types、parser、compiler、plugin-system、runtime、core、cli、config、utils）。
- `executor/`：录制执行器（VSCode 已有骨架，其余待建）。
- `docs/`：`architecture.md`、`project-structure.md` 等架构与结构说明。
- `sample/`：示例脚本 `hello-world.tutolang` 和 `vue3/`。
- 根部文档：`README.md`（使用说明）、`Reference.md`（语法参考）、`Roadmap.md`、`TODO.md`、`AGENTS.md`（AI 写作与协作规范）。

## 当前进度（截至 2025-12-16）
- **已完成**：架构与目录文档；类型定义较完整（AST/Executor/Plugin/RuntimeConfig）；各包与 CLI/Runtime/Executor/Plugin 管理器均有骨架；VSCode 执行器、CLI 参数解析、示例脚本。
- **未实现/空白**：Lexer/Parser/CodeGenerator/Compiler 主流程；Runtime 各功能（TTS、录屏、合成、Git）；PluginManager 钩子调用细节；CLI 的 compile/execute 具体逻辑；config/utils 内容；执行器的真实交互与录屏。

## 进展速记（2025-12-17 夜间）
- mock 模式：`pnpm mock-sample`/`--mock` 可输出语义化动作列表；支持 `--mockFormat json|text|both`。
- Parser MVP：行级解析支持 say/file/browser/commit/video，marker 支持 start/end/lN/edit/hl/click；忽略行注释与块注释。
- 测试：添加 parser 单测 + mock e2e 快照；jest 关闭 watchman；测试脚本改为全局 `jest`。
- 路径别名：tsconfig/jest 支持 `@tutolang/*`。

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
