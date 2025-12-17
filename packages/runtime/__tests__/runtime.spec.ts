import { strict as assert } from 'node:assert';
import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Runtime } from '../index.ts';

test('Runtime.createSlide 生成的 ffmpeg 参数中，-vf 应属于输出选项', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'tutolang-runtime-test-'));
  const capturePath = join(workDir, 'ffmpeg-args.json');
  const ffmpegPath = join(workDir, 'fake-ffmpeg.mjs');
  const ffprobePath = join(workDir, 'fake-ffprobe.mjs');
  const audioPath = join(workDir, 'demo.wav');

  await writeFile(
    ffmpegPath,
    `#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
const capture = process.env.CAPTURE_PATH;
if (capture) writeFileSync(capture, JSON.stringify(process.argv.slice(2)));
process.exit(0);
`,
    'utf-8',
  );
  await writeFile(
    ffprobePath,
    `#!/usr/bin/env node
process.stdout.write('1.0\\n');
process.exit(0);
`,
    'utf-8',
  );
  await chmod(ffmpegPath, 0o755);
  await chmod(ffprobePath, 0o755);
  await writeFile(audioPath, 'dummy', 'utf-8');

  const runtime = new Runtime({
    renderVideo: true,
    tempDir: workDir,
    ffmpeg: {
      path: ffmpegPath,
      ffprobePath,
    },
  });

  const runtimeApi = runtime as unknown as {
    createSlide: (text: string, duration?: number, audio?: string) => Promise<void>;
  };

  const previousCapture = process.env.CAPTURE_PATH;
  process.env.CAPTURE_PATH = capturePath;
  try {
    await runtimeApi.createSlide('hello', undefined, audioPath);
  } finally {
    if (previousCapture === undefined) {
      delete process.env.CAPTURE_PATH;
    } else {
      process.env.CAPTURE_PATH = previousCapture;
    }
  }

  const raw = await readFile(capturePath, 'utf-8');
  const args = JSON.parse(raw) as unknown;
  assert.ok(Array.isArray(args), '应捕获到 ffmpeg 参数列表');

  const audioInputIndex = args.findIndex((value, index) => value === '-i' && args[index + 1] === audioPath);
  assert.ok(audioInputIndex >= 0, '应包含音频输入参数');

  const vfIndex = args.indexOf('-vf');
  assert.ok(vfIndex > audioInputIndex + 1, ' -vf 应在音频输入之后（属于输出选项）');
});
