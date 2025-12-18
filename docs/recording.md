# 录屏参数模板（ffmpeg）

Tutolang 的 VSCode 录屏通过 `@tutolang/vscode-executor` 启动/停止 ffmpeg 进程完成。

你需要提供一份 **录屏参数模板**（字符串数组），并确保包含 `{output}` 占位符（运行时会替换为实际输出文件路径）：

- 推荐：环境变量 `TUTOLANG_RECORD_ARGS_JSON`
- 或写入配置：`executors.code.recording.argsTemplate`

> 提示：Runtime 会在后处理阶段把 raw 录屏转码为统一规格的 segment（并烘焙 TTS 音轨），因此 raw 录屏可以只录视频、不录音频。

## macOS（avfoundation，录全屏）

### 1) 找到屏幕采集设备编号

先列出 avfoundation 设备（会打印到 stderr）：

```bash
ffmpeg -f avfoundation -list_devices true -i ""
```

在输出中找到类似 `Capture screen 0` 的条目，记下它的 **编号**（例如 `1`）。

### 2) 设置录屏参数模板

把上一步的编号替换到 `"<编号>:none"` 里（`none` 表示不采集音频）：

```bash
export TUTOLANG_RECORD_ARGS_JSON='["-y","-f","avfoundation","-framerate","30","-i","1:none","-pix_fmt","yuv420p","-c:v","libx264","-preset","ultrafast","-crf","23","-movflags","+faststart","{output}"]'
```

然后运行你的 tutolang 命令即可。

### 3) 权限（必须）

macOS 首次录屏通常需要授权「屏幕录制」权限：

- 如果你从系统终端运行（Terminal/iTerm2），给对应的终端程序授权。
- 如果你从 VSCode 内置终端运行，可能需要给 VSCode 授权。

> 可选增强：部分 ffmpeg 版本支持 `-capture_cursor 1` / `-capture_mouse_clicks 1`，可自行尝试加在 `-i` 前提升可视化效果。

