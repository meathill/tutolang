import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import TutolangCore from '@tutolang/core';

async function main() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error('缺少 GOOGLE_API_KEY，无法生成带语音的视频。');
    process.exit(1);
  }

  const core = new TutolangCore({ language: 'zh-CN' });
  const input = join(process.cwd(), 'sample', 'hello-world.tutolang');
  const outDir = join(process.cwd(), 'dist');
  const outputVideo = join(outDir, 'hello-world-with-tts.mp4');

  await mkdir(outDir, { recursive: true });
  await core.executeFile(input, outDir, outputVideo);

  console.log('✅ 生成完成：', outputVideo);
}

main().catch((error) => {
  console.error('生成失败：', error);
  process.exit(1);
});
