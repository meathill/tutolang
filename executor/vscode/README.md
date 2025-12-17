# VSCode Executor（tutolang-vscode-extension）

目标：通过本地 RPC 驱动 VSCode（打开文件/模拟输入/移动光标/高亮），为 `file(i)` 的「真实写代码 + 录屏」打基础。

## 配置

扩展提供以下设置：

- `tutolang.port`：RPC 端口（默认 `4001`）
- `tutolang.token`：鉴权 token（可选，建议本机使用随机字符串；客户端通过 Header `x-tutolang-token` 传入）

## 运行方式（开发态）

1. 打开本仓库根目录为 VSCode 工作区（否则相对路径无法解析）。
2. 在 `executor/vscode/` 里按 VSCode 扩展的常规方式启动 Extension Host（Run Extension）。
3. 扩展启动后会监听 `http://127.0.0.1:<port>/rpc`（以及 `GET /health`）。

## Demo（打开并逐行输入 sample/index.html）

在 Extension Host 已运行的情况下，执行：

```bash
node --experimental-strip-types --experimental-transform-types scripts/vscode-demo.ts \
  --baseUrl http://127.0.0.1:4001 \
  --delayMs 12
```

## 录屏（可选）

录屏在 Node 侧由 `@tutolang/vscode-executor` 通过 ffmpeg 启动/停止，扩展本身不做屏幕录制。

1. 先准备好 ffmpeg 的参数模板（必须包含 `{output}` 占位符）。
2. 通过环境变量传入 JSON 数组：

```bash
export TUTOLANG_RECORD_ARGS_JSON='["-y", "...", "{output}"]'
node --experimental-strip-types --experimental-transform-types scripts/vscode-demo.ts --record
```

提示：
- macOS 上通常需要先用 `ffmpeg -f avfoundation -list_devices true -i \"\"` 找到屏幕采集设备名，再写入参数模板。
- 建议输出统一编码（H.264 + AAC + yuv420p），方便后续用 concat 方式合并片段。
