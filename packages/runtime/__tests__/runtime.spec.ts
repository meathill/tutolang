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

test('Runtime.createSlide 在无音频时应注入静音音轨，避免合并后音画不同步', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'tutolang-runtime-test-'));
  const capturePath = join(workDir, 'ffmpeg-args.json');
  const ffmpegPath = join(workDir, 'fake-ffmpeg.mjs');

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
  await chmod(ffmpegPath, 0o755);

  const runtime = new Runtime({
    renderVideo: true,
    tempDir: workDir,
    ffmpeg: {
      path: ffmpegPath,
      ffprobePath: ffmpegPath,
    },
  });

  const runtimeApi = runtime as unknown as {
    createSlide: (text: string, duration?: number, audio?: string) => Promise<void>;
  };

  const previousCapture = process.env.CAPTURE_PATH;
  process.env.CAPTURE_PATH = capturePath;
  try {
    await runtimeApi.createSlide('hello', 1);
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

  const hasAnullsrc = (args as string[]).some((value) => value.includes('anullsrc='));
  assert.ok(hasAnullsrc, '无音频时应使用 anullsrc 注入静音音轨');

  const audioMapIndex = (args as string[]).findIndex(
    (value, index) => value === '-map' && (args as string[])[index + 1] === '1:a:0',
  );
  assert.ok(audioMapIndex >= 0, '应显式映射静音音轨');
});

test('Runtime.inputLine 应为逐行解说生成语音并传入 createSlide', async () => {
  const runtime = new Runtime({ renderVideo: true });

  let generatedText: string | undefined;
  const fakeAudioPath = '/tmp/tutolang-fake-line.wav';
  (runtime as unknown as { tts: { generate: (text: string) => Promise<string> } }).tts.generate = async (text) => {
    generatedText = text;
    return fakeAudioPath;
  };

  let slideAudio: string | undefined;
  (
    runtime as unknown as { createSlide: (text: string, duration?: number, audioPath?: string) => Promise<void> }
  ).createSlide = async (_text, _duration, audioPath) => {
    slideAudio = audioPath;
  };

  const originalLog = console.log;
  console.log = () => undefined;
  try {
    await runtime.inputLine('index.html', 1, 'First, we declare the doctype.');
  } finally {
    console.log = originalLog;
  }
  assert.equal(generatedText, 'First, we declare the doctype.');
  assert.equal(slideAudio, fakeAudioPath);
});

test('Runtime.editLine 应为逐行解说生成语音并传入 createSlide', async () => {
  const runtime = new Runtime({ renderVideo: true });

  let generatedText: string | undefined;
  const fakeAudioPath = '/tmp/tutolang-fake-edit.wav';
  (runtime as unknown as { tts: { generate: (text: string) => Promise<string> } }).tts.generate = async (text) => {
    generatedText = text;
    return fakeAudioPath;
  };

  let slideAudio: string | undefined;
  (
    runtime as unknown as { createSlide: (text: string, duration?: number, audioPath?: string) => Promise<void> }
  ).createSlide = async (_text, _duration, audioPath) => {
    slideAudio = audioPath;
  };

  const originalLog = console.log;
  console.log = () => undefined;
  try {
    await runtime.editLine('index.html', 6, 'We will change the heading text.');
  } finally {
    console.log = originalLog;
  }
  assert.equal(generatedText, 'We will change the heading text.');
  assert.equal(slideAudio, fakeAudioPath);
});

test('Runtime.file/inputLine 在可读取源码时应输出代码预览并高亮行号', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'tutolang-runtime-test-'));
  const sourcePath = join(workDir, 'index.html');
  await writeFile(
    sourcePath,
    ['<!doctype html>', '<html>', '<head>', '</head>', '<body>', '  <h1>Hello World</h1>', '</body>', '</html>'].join(
      '\n',
    ),
    'utf-8',
  );

  const runtime = new Runtime({ renderVideo: true, projectDir: workDir });

  (runtime as unknown as { tts: { generate: (text: string) => Promise<string | null> } }).tts.generate = async () =>
    '/tmp/tutolang-fake.wav';

  const slides: Array<{ text: string; layout?: string }> = [];
  (
    runtime as unknown as {
      createSlide: (
        text: string,
        duration?: number,
        audioPath?: string,
        options?: { layout?: string },
      ) => Promise<void>;
    }
  ).createSlide = async (text, _duration, _audioPath, options) => {
    slides.push({ text, layout: options?.layout });
  };

  const originalLog = console.log;
  console.log = () => undefined;
  try {
    await runtime.file('index.html', { mode: 'i' });
    await runtime.inputLine('index.html', 1, 'First, we declare the doctype.');
    await runtime.inputLine('index.html', 5, 'The body tag will contain our content.');
  } finally {
    console.log = originalLog;
  }

  assert.equal(slides[0]?.layout, 'code');
  assert.match(slides[0]?.text ?? '', /index\.html \(i\) 0\/8/);

  assert.equal(slides[1]?.layout, 'code');
  assert.match(slides[1]?.text ?? '', />1\| <!doctype html>/);
  assert.match(slides[1]?.text ?? '', /解说：First, we declare the doctype\./);

  assert.equal(slides[2]?.layout, 'code');
  assert.match(slides[2]?.text ?? '', />5\| <body>/);
  assert.match(slides[2]?.text ?? '', / 2\| <html>/);
});
