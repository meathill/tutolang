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

test('Runtime.browser 在 renderVideo 且配置 browserExecutor 时应以截图生成视频片段', async () => {
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

  const raw = await readFile(capturePath, 'utf-8');
  const captured = JSON.parse(raw) as string[][];
  assert.ok(captured.length >= 1, '应捕获到 ffmpeg 调用');

  const args = captured[0] ?? [];
  const hasLoopImage = args.some((value, index) => value === '-loop' && args[index + 1] === '1') && args.includes(screenshotPath);
  assert.ok(hasLoopImage, '应以 -loop 1 方式加载截图作为视频输入');

  const hasAnullsrc = args.some((value) => String(value).includes('anullsrc='));
  assert.ok(hasAnullsrc, '无音频时应注入静音音轨');

  const hasDuration = args.some((value, index) => value === '-t' && args[index + 1] === '1.2');
  assert.ok(hasDuration, '应按 Runtime.browser 的默认时长截断输出');
});

test('Runtime.highlight/click 在 renderVideo 且配置 browserExecutor 时应使用截图而非文字 slide', async () => {
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
    const hasLoop = args.some((value, index) => value === '-loop' && args[index + 1] === '1');
    assert.ok(hasLoop, '截图片段应使用 -loop 1 输入图片');
    const vfIndex = args.indexOf('-vf');
    assert.ok(vfIndex >= 0, '应包含 -vf');
    const vf = args[vfIndex + 1] ?? '';
    assert.ok(!String(vf).includes('drawtext='), '无文本时不应叠加 drawtext');
  }
});

