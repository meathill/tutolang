// Tutolang 配置文件模板（最小可用）
//
// 使用方式：
// 1) 复制本文件到项目根目录并命名为 `tutolang.config.ts`
// 2) 或者运行：pnpm init-config
//
// 配置文件查找顺序见 README.md。

export default {
  // 视频语言（暂用于全局设置，未来会影响 TTS/字幕/排版等）
  language: 'zh',

  runtime: {
    // 默认 true：生成真实 mp4；若只想验证脚本流程可用 `--mock`
    renderVideo: true,

    // AI 调用缓存目录（默认 `{CWD}/.tutolang-cache/`）
    // cacheDir: '.tutolang-cache',

    tts: {
      // 如果你暂时不想调用 TTS（例如额度用完），可设置：
      // engine: 'none',

      // 未配置 API Key 时，仍可生成视频，但解说会静音（会注入静音音轨以保证片段可合并）
      // apiKey: process.env.GOOGLE_API_KEY,

      // 可选：覆盖默认模型/音色
      // model: 'gemini-2.5-flash-preview-tts',
      // voiceName: 'Puck',
      // sampleRateHertz: 24000,
    },

    ffmpeg: {
      // 可选：指定本机 ffmpeg/ffprobe 路径（默认使用 PATH 里的命令）
      // path: 'ffmpeg',
      // ffprobePath: 'ffprobe',
    },

    // 可选：屏幕尺寸与输出参数（尚在完善）
    // screen: { width: 1920, height: 1080 },
    // output: { fps: 30 },
  },
} as const;
