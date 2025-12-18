# Tutolang Project Structure

## Root Directory
```
tutolang/
├── packages/           # Core packages (monorepo)
├── executor/          # Executor implementations
├── docs/              # Documentation
├── sample/            # Example .tutolang files
├── tests/             # Test files
├── README.md          # Project overview
├── Reference.md       # Language reference
├── Roadmap.md         # Development roadmap
├── TODO.md            # Todo list
└── package.json       # Root package config（Node 24，零转译）
```

## Packages

### packages/types
Type definitions shared across all packages.

**Key files:**
- `index.ts` - All TypeScript interfaces and types

### packages/parser
Lexical and syntax analysis for .tutolang files.

**Key files:**
- `index.ts` - Lexer and Parser classes

**Responsibilities:**
- Tokenize source code
- Build Abstract Syntax Tree (AST)
- Error reporting

### packages/compiler
Compiles AST to executable TypeScript code.

**Key files:**
- `index.ts` - Compiler and CodeGenerator classes

**Responsibilities:**
- Transform AST
- Generate TypeScript code
- Plugin management integration

### packages/plugin-system
Plugin architecture for extensibility.

**Key files:**
- `index.ts` - PluginManager and BasePlugin classes

**Responsibilities:**
- Load and register plugins
- Call lifecycle hooks
- Manage plugin dependencies

### packages/runtime
Runtime functions called by generated code.

**Key files:**
- `index.ts` - Package exports (barrel)
- `runtime.ts` - Runtime class (main implementation)

**Responsibilities:**
- TTS generation
- Video recording coordination
- Video merging
- Git operations

### packages/core
Main orchestration layer.

**Key files:**
- `index.ts` - TutolangCore class

**Responsibilities:**
- Coordinate compiler and runtime
- File I/O
- High-level API

### packages/cli
Command-line interface.

**Key files:**
- `index.ts` - CLI entry point
- `config-loader.ts` - CLI config loader (`tutolang.config.*`)
- `executor-factory.ts` - Build CodeExecutor instances from config

**Responsibilities:**
- Parse command-line arguments
- Load configuration
- Execute compilation/generation

### packages/config
Configuration management.

**Key files:**
- `index.ts` - (placeholder)

**Responsibilities:**
- (TBD) Future shared config utilities
- 当前 CLI 配置加载在 `packages/cli/config-loader.ts`

### packages/utils
Shared utilities.

**Key files:**
- `index.ts` - Utility functions

**Responsibilities:**
- Common helper functions
- File system operations
- String manipulation

## Executors

### executor/vscode
VSCode extension for code input recording.

**Key files:**
- `src/extension.ts` - VSCode extension entry
- `src/VSCodeExecutor.ts` - Executor implementation

**Responsibilities:**
- Control VSCode editor
- Simulate typing
- Record screen

### executor/browser
Browser automation using Puppeteer.

**Key files:**
- `src/index.ts` - PuppeteerExecutor implementation

**Responsibilities:**
- Control browser
- Simulate interactions
- Record browser window

### executor/terminal
Terminal recording.

**Key files:**
- `src/index.ts` - TerminalRecorder implementation

**Responsibilities:**
- Execute shell commands
- Simulate terminal input
- Record terminal session

## Development

### Adding a new package
1. Create directory under `packages/`
2. Add `package.json` with workspace dependencies
3. Update root `pnpm-workspace.yaml` if needed
4. Implement package interface
5. Update `TODO.md`

### Adding a new executor
1. Create directory under `executor/`
2. Implement the corresponding interface from `@tutolang/types`
3. Add package dependencies
4. Update documentation

### 测试
根目录直接使用 Node 原生测试：
```bash
pnpm test
```
(等价于 `node --experimental-strip-types --experimental-transform-types --test ...`)

### 构建
当前为零转译开发模式，无需构建步骤；后续若需产出 JS 包再补充构建脚本。

### Lint
```bash
pnpm lint
```
