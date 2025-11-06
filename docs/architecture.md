# Tutolang 架构设计

## 总体架构

```
┌─────────────┐
│ .tutolang   │  源文件
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Parser    │  词法+语法分析
└──────┬──────┘
       │
       ▼
┌─────────────┐
│     AST     │  抽象语法树
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Compiler   │  编译器 + 插件系统
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ TypeScript  │  可执行的 TS 代码
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Runtime    │  运行时函数库
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Executor   │  执行器(VSCode/Browser/Terminal)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Video     │  视频输出
└─────────────┘
```

## 包结构

### packages/types
类型定义，所有包共享的 TypeScript 类型。

### packages/parser
解析 .tutolang 文件，生成 AST。

核心类：
- `Lexer`: 词法分析器
- `Parser`: 语法分析器
- `AST`: 抽象语法树节点定义

### packages/compiler
将 AST 编译为可执行的 TypeScript 代码。

核心类：
- `Compiler`: 编译器主类
- `CodeGenerator`: 代码生成器
- `PluginManager`: 插件管理器

### packages/plugin-system
插件系统，允许第三方扩展功能。

核心接口：
- `Plugin`: 插件基类
- `PluginHooks`: 生命周期钩子

### packages/runtime
运行时函数库，提供视频制作的实际功能。

核心模块：
- `say()`: 文本转语音 + 静态画面
- `file()`: 文件展示 + 代码输入
- `browser()`: 浏览器操作录制
- `video()`: 视频片段插入
- `merge()`: 视频合成

### packages/cli
命令行工具。

### executor/
执行器实现，负责实际的录制工作。

- `executor/vscode`: VSCode 执行器
- `executor/browser`: 浏览器执行器（Puppeteer）
- `executor/terminal`: 终端执行器

## 插件系统

插件可以在以下阶段介入：

1. **beforeParse**: 源码预处理
2. **afterParse**: AST 后处理
3. **beforeCompile**: 编译前处理
4. **afterCompile**: 生成代码后处理
5. **beforeExecute**: 执行前处理
6. **afterExecute**: 执行后处理

## 数据流

1. 用户编写 `.tutolang` 文件
2. Parser 解析为 AST
3. Compiler 应用插件转换 AST
4. CodeGenerator 生成可执行的 TypeScript 代码
5. 运行生成的代码，调用 Runtime 函数
6. Executor 执行录制任务
7. 合成最终视频

## 扩展性

- **新语法**: 修改 Parser
- **新功能**: 添加 Runtime 函数
- **新执行器**: 实现 Executor 接口
- **第三方扩展**: 编写 Plugin

## Git Workflow

项目使用 Git 管理代码历史，每个 commit 代表一个场景：

1. 解析 tutolang 时记录 `commit` 指令
2. 执行时切换到指定 commit
3. 根据 diff 生成输入动作
4. 录制完成后切换到下一个 commit
