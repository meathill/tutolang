# 开发笔记

## 运行环境

- Node.js >= 24（本仓库大量脚本/测试依赖 `--experimental-strip-types --experimental-transform-types` 原生执行 `.ts`）
- 包管理器：pnpm
- 视频相关：本机可执行 `ffmpeg` / `ffprobe`

## 配置文件

CLI 会自动加载配置文件（也可用 `--config <path>` 指定）：

- `{CWD}/tutolang.config.{ts,js,mjs,cjs,json}`
- `~/tutolang/config.{ts,js,mjs,cjs,json}`

可用 `pnpm init-config` 生成模板（见 `docs/templates/`）。

## VSCode 录屏（macOS 常见坑）

- 需要启动 `executor/vscode` 的 Extension Host（提供 RPC）
- 录屏由 Node 侧启动 ffmpeg，通常需要先授权「屏幕录制」权限（Terminal/iTerm2 或 VSCode）
- 录屏参数模板示例见 `docs/recording.md`

