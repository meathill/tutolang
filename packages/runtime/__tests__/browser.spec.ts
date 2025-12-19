import { strict as assert } from 'node:assert';
import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { BrowserExecutor } from '@tutolang/types';
import { Runtime } from '../index.ts';

class FakeBrowserExecutor implements BrowserExecutor {
  name = 'fake-browser';
  calls: Array<{ method: string; args: unknown[] }> = [];
  private screenshotPath: string;

  constructor(screenshotPath: string) {
    this.screenshotPath = screenshotPath;
  }

  async initialize(): Promise<void> {
    this.calls.push({ method: 'initialize', args: [] });
  }

  async cleanup(): Promise<void> {
    this.calls.push({ method: 'cleanup', args: [] });
  }

  async navigate(url: string): Promise<void> {
    this.calls.push({ method: 'navigate', args: [url] });
  }

  async click(selector: string): Promise<void> {
    this.calls.push({ method: 'click', args: [selector] });
  }

  async type(selector: string, text: string): Promise<void> {
    this.calls.push({ method: 'type', args: [selector, text] });
  }

  async highlight(selector: string): Promise<void> {
    this.calls.push({ method: 'highlight', args: [selector] });
  }

  async screenshot(): Promise<string> {
    this.calls.push({ method: 'screenshot', args: [] });
    return this.screenshotPath;
  }

  async startRecording(): Promise<void> {
    this.calls.push({ method: 'startRecording', args: [] });
  }

  async stopRecording(): Promise<string> {
    this.calls.push({ method: 'stopRecording', args: [] });
    return '/tmp/fake-browser-recording.mp4';
  }
}

test('Runtime.browser 在 renderVideo 且配置 browserExecutor 时应仅导航，不直接生成片段', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'tutolang-runtime-browser-test-'));
  const capturePath = join(workDir, 'ffmpeg-args.json');
  const ffmpegPath = join(workDir, 'fake-ffmpeg.mjs');
  const screenshotPath = join(workDir, 'shot.png');

  await writeFile(
    ffmpegPath,
    `#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const capture = process.env.CAPTURE_PATH;
if (capture) {
  const existing = existsSync(capture) ? JSON.parse(readFileSync(capture, 'utf-8')) : [];
  existing.push(process.argv.slice(2));
  writeFileSync(capture, JSON.stringify(existing));
}
process.exit(0);
`,
    'utf-8',
  );
  await chmod(ffmpegPath, 0o755);

  await writeFile(join(workDir, 'index.html'), '<!doctype html><title>demo</title>', 'utf-8');

  const runtime = new Runtime({
    renderVideo: true,
    projectDir: workDir,
    tempDir: workDir,
    ffmpeg: { path: ffmpegPath, ffprobePath: ffmpegPath },
  });

  const executor = new FakeBrowserExecutor(screenshotPath);
  runtime.setBrowserExecutor(executor);

  const originalLog = console.log;
  console.log = () => undefined;
  const previousCapture = process.env.CAPTURE_PATH;
  process.env.CAPTURE_PATH = capturePath;
  try {
    await runtime.browser('index.html');
  } finally {
    console.log = originalLog;
    if (previousCapture === undefined) delete process.env.CAPTURE_PATH;
    else process.env.CAPTURE_PATH = previousCapture;
  }

  const navigateCall = executor.calls.find((call) => call.method === 'navigate');
  assert.ok(navigateCall, '应调用 navigate');
  assert.ok(String(navigateCall.args[0]).startsWith('file://'), '本地页面应转换为 file:// URL');

  await assert.rejects(() => readFile(capturePath, 'utf-8'), /ENOENT/, 'browser() 在有 executor 时不应直接生成视频片段');
});

test('Runtime.say(browser=true) 在 renderVideo 且配置 browserExecutor 时应录制并转码为片段（失败时再降级截图）', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'tutolang-runtime-browser-test-'));
  const capturePath = join(workDir, 'ffmpeg-args.json');
  const ffmpegPath = join(workDir, 'fake-ffmpeg.mjs');
  const screenshotPath = join(workDir, 'shot.png');

  await writeFile(
    ffmpegPath,
    `#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const capture = process.env.CAPTURE_PATH;
if (capture) {
  const existing = existsSync(capture) ? JSON.parse(readFileSync(capture, 'utf-8')) : [];
  existing.push(process.argv.slice(2));
  writeFileSync(capture, JSON.stringify(existing));
}
process.exit(0);
`,
    'utf-8',
  );
  await chmod(ffmpegPath, 0o755);

  const runtime = new Runtime({
    renderVideo: true,
    tempDir: workDir,
    ffmpeg: { path: ffmpegPath, ffprobePath: ffmpegPath },
  });

  const executor = new FakeBrowserExecutor(screenshotPath);
  runtime.setBrowserExecutor(executor);
  (runtime as unknown as { delay: () => Promise<void> }).delay = async () => undefined;
  (runtime as unknown as { tts: { generate: () => Promise<string | undefined> } }).tts.generate = async () => undefined;

  const originalLog = console.log;
  console.log = () => undefined;
  const previousCapture = process.env.CAPTURE_PATH;
  process.env.CAPTURE_PATH = capturePath;
  try {
    await runtime.say('hello', { browser: 'true' });
  } finally {
    console.log = originalLog;
    if (previousCapture === undefined) delete process.env.CAPTURE_PATH;
    else process.env.CAPTURE_PATH = previousCapture;
  }

  const methods = executor.calls.map((call) => call.method);
  assert.ok(methods.includes('startRecording') && methods.includes('stopRecording'), '应调用 start/stopRecording');

  const raw = await readFile(capturePath, 'utf-8');
  const captured = JSON.parse(raw) as string[][];
  assert.equal(captured.length, 1, '应生成一个转码片段');

  const args = captured[0] ?? [];
  const hasCaptureInput = args.some((value, index) => value === '-i' && args[index + 1] === '/tmp/fake-browser-recording.mp4');
  assert.ok(hasCaptureInput, '应以 stopRecording 返回的 capturePath 作为视频输入');
});

test('Runtime.highlight/click 在 renderVideo 且配置 browserExecutor 时应录制并转码为片段', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'tutolang-runtime-browser-test-'));
  const capturePath = join(workDir, 'ffmpeg-args.json');
  const ffmpegPath = join(workDir, 'fake-ffmpeg.mjs');
  const screenshotPath = join(workDir, 'shot.png');

  await writeFile(
    ffmpegPath,
    `#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const capture = process.env.CAPTURE_PATH;
if (capture) {
  const existing = existsSync(capture) ? JSON.parse(readFileSync(capture, 'utf-8')) : [];
  existing.push(process.argv.slice(2));
  writeFileSync(capture, JSON.stringify(existing));
}
process.exit(0);
`,
    'utf-8',
  );
  await chmod(ffmpegPath, 0o755);

  const runtime = new Runtime({
    renderVideo: true,
    tempDir: workDir,
    ffmpeg: { path: ffmpegPath, ffprobePath: ffmpegPath },
  });

  const executor = new FakeBrowserExecutor(screenshotPath);
  runtime.setBrowserExecutor(executor);
  (runtime as unknown as { delay: () => Promise<void> }).delay = async () => undefined;

  const originalLog = console.log;
  console.log = () => undefined;
  const previousCapture = process.env.CAPTURE_PATH;
  process.env.CAPTURE_PATH = capturePath;
  try {
    await runtime.highlight('#app');
    await runtime.click('#submit');
  } finally {
    console.log = originalLog;
    if (previousCapture === undefined) delete process.env.CAPTURE_PATH;
    else process.env.CAPTURE_PATH = previousCapture;
  }

  const raw = await readFile(capturePath, 'utf-8');
  const captured = JSON.parse(raw) as string[][];
  assert.equal(captured.length, 2, '应为 highlight/click 各生成一个 ffmpeg 片段');

  for (const args of captured) {
    const hasCaptureInput = args.some((value, index) => value === '-i' && args[index + 1] === '/tmp/fake-browser-recording.mp4');
    assert.ok(hasCaptureInput, '应以 stopRecording 返回的 capturePath 作为视频输入');

    const hasLoop = args.some((value, index) => value === '-loop' && args[index + 1] === '1');
    assert.ok(!hasLoop, '录制片段不应使用 -loop 1 输入图片');

    const hasAnullsrc = args.some((value) => String(value).includes('anullsrc='));
    assert.ok(hasAnullsrc, '无音频时应注入静音音轨');

    const hasDuration = args.some((value, index) => value === '-t' && args[index + 1] === '1');
    assert.ok(hasDuration, '无解说时应按默认最小时长截断输出');
  }
});
