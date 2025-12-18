import { strict as assert } from 'node:assert';
import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createBrowserExecutor, createCodeExecutor } from '../executor-factory.ts';

test('createCodeExecutor 在未配置/none 时应返回 undefined', async () => {
  assert.equal(await createCodeExecutor(undefined), undefined);
  assert.equal(await createCodeExecutor({ type: 'none' }), undefined);
});

test('createBrowserExecutor 在未配置/none 时应返回 undefined', async () => {
  assert.equal(await createBrowserExecutor(undefined), undefined);
  assert.equal(await createBrowserExecutor({ type: 'none' }), undefined);
});

test('createBrowserExecutor(puppeteer) 应返回 BrowserExecutor 实例（无需在创建时安装 puppeteer）', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'tutolang-cli-browser-executor-test-'));
  const executor = await createBrowserExecutor(
    {
      type: 'puppeteer',
      headless: true,
      screenshotDir: join(workDir, 'shots'),
      viewport: { width: 1280, height: 720 },
    },
    { outputDir: workDir },
  );
  assert.ok(executor, '应创建 BrowserExecutor 实例');
  assert.equal(executor.name, 'browser');
});

test('createCodeExecutor(vscode) 缺少 argsTemplate 时应抛错', async () => {
  await assert.rejects(
    () =>
      createCodeExecutor({
        type: 'vscode',
        recording: { outputDir: 'dist/captures' },
      }),
    /argsTemplate/,
  );
});

test('createCodeExecutor(vscode) argsTemplate 不包含 {output} 时应抛错', async () => {
  await assert.rejects(
    () =>
      createCodeExecutor({
        type: 'vscode',
        recording: { argsTemplate: ['-y', 'out.mp4'] },
      }),
    /\{output\}/,
  );
});

test('createCodeExecutor(vscode) 应可启动/停止录屏并把输出写入默认 captures 目录', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'tutolang-cli-executor-test-'));
  const ffmpegPath = join(workDir, 'fake-ffmpeg.mjs');
  const capturedArgsPath = join(workDir, 'captured-args.json');

  await writeFile(
    ffmpegPath,
    `#!/usr/bin/env node
import { writeFileSync } from 'node:fs';

const argsPath = process.env.CAPTURE_ARGS_PATH;
if (argsPath) {
  writeFileSync(argsPath, JSON.stringify(process.argv.slice(2)));
}

process.stdin.setEncoding('utf8');
await new Promise((resolve) => {
  process.stdin.on('data', (chunk) => {
    if (String(chunk).includes('q')) resolve(undefined);
  });
});

process.exit(0);
`,
    'utf-8',
  );
  await chmod(ffmpegPath, 0o755);

  const previousCapture = process.env.CAPTURE_ARGS_PATH;
  process.env.CAPTURE_ARGS_PATH = capturedArgsPath;
  try {
    const executor = await createCodeExecutor(
      {
        type: 'vscode',
        baseUrl: 'http://127.0.0.1:4001',
        recording: {
          ffmpegPath,
          argsTemplate: ['-y', '{output}'],
        },
      },
      { outputDir: workDir },
    );
    assert.ok(executor, '应创建 CodeExecutor 实例');
    assert.equal(executor.name, 'vscode');

    await executor.startRecording();
    const outputPath = await executor.stopRecording();
    assert.ok(outputPath.startsWith(join(workDir, 'captures')), '默认输出目录应为 {outputDir}/captures');

    const raw = await readFile(capturedArgsPath, 'utf-8');
    const args = JSON.parse(raw) as unknown;
    assert.ok(Array.isArray(args), '应捕获到 ffmpeg 参数');
    assert.ok((args as string[]).includes(outputPath), '{output} 应替换为实际输出路径');
  } finally {
    if (previousCapture === undefined) delete process.env.CAPTURE_ARGS_PATH;
    else process.env.CAPTURE_ARGS_PATH = previousCapture;
  }
});
