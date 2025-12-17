import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { TTS } from '@tutolang/runtime';

async function main() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error('缺少环境变量 GOOGLE_API_KEY，无法调用 Gemini TTS。');
    process.exit(1);
  }

  const outputDir = join(process.cwd(), 'dist', 'tts-smoke');
  await mkdir(outputDir, { recursive: true });

  const tts = new TTS({
    apiKey,
    model: 'gemini-2.5-flash-preview-tts',
    voiceName: 'Sadaltager',
    sampleRateHertz: 24000,
    tempDir: outputDir,
  });

  const text = '请用睿智的声音说：你好，Tutolang！这是一次 TTS 冒烟测试。';
  const audioPath = await tts.generate(text);

  if (!audioPath) {
    console.error('TTS 生成失败，未返回音频路径。');
    process.exit(1);
  }

  console.log('✅ 生成完成，音频文件：', audioPath);
}

main().catch((error) => {
  console.error('TTS 冒烟测试失败：', error);
  process.exit(1);
});
