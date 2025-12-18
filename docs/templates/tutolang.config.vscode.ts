// Tutolang 配置文件模板（VSCode 录屏版）
//
// 使用方式：
// 1) 复制本文件到项目根目录并命名为 `tutolang.config.ts`
// 2) 或者运行：pnpm init-config -- --template vscode
//
// 该模板会启用 `executors.code.type = "vscode"`，用于驱动 VSCode 输入并由 ffmpeg 录屏。
// 你仍需要按自己的系统补全录屏参数模板（见下方 recording.argsTemplate / 环境变量说明）。

export default {
  language: 'zh',

  runtime: {
    renderVideo: true,
    tts: {
      // apiKey: process.env.GOOGLE_API_KEY,
    },
    ffmpeg: {
      // path: 'ffmpeg',
      // ffprobePath: 'ffprobe',
    },
  },

  executors: {
    code: {
      type: 'vscode',

      // VSCode 扩展的 RPC 地址（在 Extension Host 启动后可用）
      baseUrl: 'http://127.0.0.1:4001',

      // 可选：鉴权 token（扩展侧也要配置同样的 token）
      // token: process.env.TUTOLANG_VSCODE_TOKEN,

      // 输入速度（毫秒/字符），可按录制效果微调
      typingDelayMs: 12,

      recording: {
        // 录屏输出目录（相对路径会以当前工作目录为基准）
        outputDir: 'dist/captures',

        // 录屏参数模板（二选一）：
        // 1) 配置里写 argsTemplate
        // 2) 或使用环境变量 TUTOLANG_RECORD_ARGS_JSON（推荐：不同系统差异更好管理）
        //
        // 注意：模板必须包含 `{output}` 占位符，运行时会替换为实际输出文件路径。
        //
        // argsTemplate: ['-y', '...', '{output}'],
        //
        // 示例（仅占位，需按系统补全）：
        // macOS（avfoundation）示例：
        // 1) ffmpeg -f avfoundation -list_devices true -i \"\"
        // 2) 把下面的 \"1:none\" 改成你的屏幕编号
        // export TUTOLANG_RECORD_ARGS_JSON='[\"-y\",\"-f\",\"avfoundation\",\"-framerate\",\"30\",\"-i\",\"1:none\",\"-pix_fmt\",\"yuv420p\",\"-c:v\",\"libx264\",\"-preset\",\"ultrafast\",\"-crf\",\"23\",\"-movflags\",\"+faststart\",\"{output}\"]'
      },
    },

    // 可选：浏览器预览（当前为“截图生成视频片段”的 MVP）
    // 需要额外安装依赖（其一即可）：
    // - pnpm -w add -D puppeteer
    // - pnpm -w add -D puppeteer-core
    //
    // browser: {
    //   type: 'puppeteer',
    //   headless: true,
    //   screenshotDir: 'dist/browser-captures',
    //   viewport: { width: 1280, height: 720 },
    // },
  },
} as const;
