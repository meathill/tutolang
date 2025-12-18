import { strict as assert } from 'node:assert';
import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { CodeExecutor } from '@tutolang/types';
import { Runtime } from '../index.ts';

class FakeCodeExecutor implements CodeExecutor {
  name = 'fake';
  calls: Array<{ method: string; args: unknown[] }> = [];
  private recordingIndex = 0;

  async initialize(): Promise<void> {
    this.calls.push({ method: 'initialize', args: [] });
  }

  async cleanup(): Promise<void> {
    this.calls.push({ method: 'cleanup', args: [] });
  }

  async openFile(
    path: string,
    options?: { createIfMissing?: boolean; clear?: boolean; preview?: boolean; viewColumn?: number },
  ): Promise<void> {
    this.calls.push({ method: 'openFile', args: [path, options] });
  }

  async writeLine(
    content: string,
    lineNumber?: number,
    options?: { delayMs?: number; appendNewLine?: boolean },
  ): Promise<void> {
    this.calls.push({ method: 'writeLine', args: [content, lineNumber, options] });
  }

  async writeChar(char: string, options?: { delayMs?: number }): Promise<void> {
    this.calls.push({ method: 'writeChar', args: [char, options] });
  }

  async highlightLine(lineNumber: number, options?: { durationMs?: number }): Promise<void> {
    this.calls.push({ method: 'highlightLine', args: [lineNumber, options] });
  }

  async moveCursor(line: number, column: number): Promise<void> {
    this.calls.push({ method: 'moveCursor', args: [line, column] });
  }

  async startRecording(): Promise<void> {
    this.calls.push({ method: 'startRecording', args: [] });
  }

  async stopRecording(): Promise<string> {
    this.calls.push({ method: 'stopRecording', args: [] });
    const outputPath = `/tmp/tutolang-fake-capture-${this.recordingIndex}.mp4`;
    this.recordingIndex += 1;
    return outputPath;
  }
}

test('Runtime.file(i)+inputLine 在 renderVideo 且配置 codeExecutor 时应录屏并补齐未标注行', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'tutolang-runtime-record-test-'));
  const capturePath = join(workDir, 'ffmpeg-args.json');
  const ffmpegPath = join(workDir, 'fake-ffmpeg.mjs');
  const ffprobePath = join(workDir, 'fake-ffprobe.mjs');

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

  const sourcePath = join(workDir, 'index.html');
  await writeFile(sourcePath, ['a', 'b', 'c'].join('\n'), 'utf-8');
  const audioPath = join(workDir, 'demo.wav');
  await writeFile(audioPath, 'dummy', 'utf-8');

  const runtime = new Runtime({
    renderVideo: true,
    projectDir: workDir,
    tempDir: workDir,
    ffmpeg: { path: ffmpegPath, ffprobePath },
  });

  const executor = new FakeCodeExecutor();
  runtime.setCodeExecutor(executor);

  (runtime as unknown as { tts: { generate: () => Promise<string> } }).tts.generate = async () => audioPath;
  (runtime as unknown as { delay: () => Promise<void> }).delay = async () => undefined;

  const originalLog = console.log;
  console.log = () => undefined;
  const previousCapture = process.env.CAPTURE_PATH;
  process.env.CAPTURE_PATH = capturePath;
  try {
    await runtime.file('index.html', { mode: 'i' });
    await runtime.inputLine('index.html', 1, '第一行');
    await runtime.inputLine('index.html', 3, '第三行');
  } finally {
    console.log = originalLog;
    if (previousCapture === undefined) {
      delete process.env.CAPTURE_PATH;
    } else {
      process.env.CAPTURE_PATH = previousCapture;
    }
  }

  const openCall = executor.calls.find((call) => call.method === 'openFile');
  assert.ok(openCall, '应调用 openFile 打开并清空文件');
  assert.deepEqual(openCall.args[1], { createIfMissing: true, clear: true });
  assert.equal(openCall.args[0], sourcePath);

  const methods = executor.calls.map((call) => call.method);
  const firstStart = methods.indexOf('startRecording');
  const firstStop = methods.indexOf('stopRecording');
  assert.ok(firstStart >= 0 && firstStop > firstStart, '应存在录屏 start/stop');

  const writeLines = executor.calls.filter((call) => call.method === 'writeLine');
  assert.equal(writeLines.length, 3, '应逐行输入并补齐未标注行');
  assert.equal(writeLines[0]?.args[0], 'a');
  assert.equal(writeLines[1]?.args[0], 'b');
  assert.equal(writeLines[2]?.args[0], 'c');

  const raw = await readFile(capturePath, 'utf-8');
  const captured = JSON.parse(raw) as string[][];
  assert.ok(Array.isArray(captured) && captured.length >= 1, '应捕获到 ffmpeg 调用参数');

  const args = captured[0] ?? [];
  const hasAudioInput = args.some((value, index) => value === '-i' && args[index + 1] === audioPath);
  assert.ok(hasAudioInput, '应注入解说音频作为第二路输入');

  const hasApad = args.some((value) => value === '-af') && args.some((value) => String(value).includes('apad=whole_dur='));
  assert.ok(hasApad, '应使用 apad 将音轨补齐到片段时长');

  const vfIndex = args.indexOf('-vf');
  const audioInputIndex = args.findIndex((value, index) => value === '-i' && args[index + 1] === audioPath);
  assert.ok(vfIndex > audioInputIndex + 1, ' -vf 应在音频输入之后（属于输出选项）');
});

test('Runtime.inputLine 在录屏路径下无音频时应注入静音音轨', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'tutolang-runtime-record-test-'));
  const capturePath = join(workDir, 'ffmpeg-args.json');
  const ffmpegPath = join(workDir, 'fake-ffmpeg.mjs');

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

  const sourcePath = join(workDir, 'index.html');
  await writeFile(sourcePath, ['a'].join('\n'), 'utf-8');

  const runtime = new Runtime({
    renderVideo: true,
    projectDir: workDir,
    tempDir: workDir,
    ffmpeg: { path: ffmpegPath, ffprobePath: ffmpegPath },
  });

  const executor = new FakeCodeExecutor();
  runtime.setCodeExecutor(executor);

  (runtime as unknown as { delay: () => Promise<void> }).delay = async () => undefined;

  const originalLog = console.log;
  console.log = () => undefined;
  const previousCapture = process.env.CAPTURE_PATH;
  process.env.CAPTURE_PATH = capturePath;
  try {
    await runtime.file('index.html', { mode: 'i' });
    await runtime.inputLine('index.html', 1);
  } finally {
    console.log = originalLog;
    if (previousCapture === undefined) {
      delete process.env.CAPTURE_PATH;
    } else {
      process.env.CAPTURE_PATH = previousCapture;
    }
  }

  const raw = await readFile(capturePath, 'utf-8');
  const captured = JSON.parse(raw) as string[][];
  const args = captured[0] ?? [];

  const hasAnullsrc = args.some((value) => String(value).includes('anullsrc='));
  assert.ok(hasAnullsrc, '无音频时应使用 anullsrc 注入静音音轨');
});

