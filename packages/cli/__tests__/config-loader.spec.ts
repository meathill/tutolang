import { strict as assert } from 'node:assert';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadCliConfig } from '../config-loader.ts';

async function withTempCwd<T>(fn: (cwd: string) => Promise<T>): Promise<T> {
  const workDir = await mkdtemp(join(tmpdir(), 'tutolang-cli-config-test-'));
  const previous = process.cwd();
  process.chdir(workDir);
  try {
    return await fn(process.cwd());
  } finally {
    process.chdir(previous);
  }
}

test('loadCliConfig 应支持从当前目录加载 tutolang.config.ts，并规范化 outputDir 与 argsTemplate', async () => {
  await withTempCwd(async (cwd) => {
    const configPath = join(cwd, 'tutolang.config.ts');
    await writeFile(
      configPath,
      `export default {
  language: 'zh',
  runtime: { renderVideo: true, cacheDir: '.tutolang-cache' },
  executors: {
    code: {
      type: 'vscode',
      baseUrl: 'http://127.0.0.1:4001',
      typingDelayMs: 12,
      recording: {
        argsTemplate: ['-y', '{output}'],
        outputDir: 'dist/captures',
      },
    },
  },
} as const;`,
      'utf-8',
    );

    const loaded = await loadCliConfig();
    assert.equal(loaded.path, configPath);
    assert.equal(loaded.config.language, 'zh');
    assert.equal(loaded.config.runtime?.renderVideo, true);
    assert.equal(loaded.config.runtime?.cacheDir, '.tutolang-cache');

    const code = loaded.config.executors?.code;
    assert.ok(code && code.type === 'vscode');
    assert.equal(code.baseUrl, 'http://127.0.0.1:4001');
    assert.equal(code.typingDelayMs, 12);
    assert.deepEqual(code.recording?.argsTemplate, ['-y', '{output}']);
    assert.equal(code.recording?.outputDir, join(cwd, 'dist', 'captures'));
  });
});

test('loadCliConfig 应支持 executors.browser(puppeteer)，并规范化 screenshotDir', async () => {
  await withTempCwd(async (cwd) => {
    const configPath = join(cwd, 'tutolang.config.ts');
    await writeFile(
      configPath,
      `export default {
  executors: {
    browser: {
      type: 'puppeteer',
      headless: false,
      screenshotDir: 'dist/browser-captures',
      recording: {
        outputDir: 'dist/browser-recordings',
        fps: 30,
        format: 'jpeg',
        quality: 80,
        ffmpegPath: 'ffmpeg',
      },
      viewport: { width: 1280, height: 720, deviceScaleFactor: 2 },
    },
  },
} as const;`,
      'utf-8',
    );

    const loaded = await loadCliConfig();
    assert.equal(loaded.path, configPath);

    const browser = loaded.config.executors?.browser;
    assert.ok(browser && browser.type === 'puppeteer');
    assert.equal(browser.headless, false);
    assert.equal(browser.screenshotDir, join(cwd, 'dist', 'browser-captures'));
    assert.deepEqual(browser.recording, {
      outputDir: join(cwd, 'dist', 'browser-recordings'),
      fps: 30,
      format: 'jpeg',
      quality: 80,
      ffmpegPath: 'ffmpeg',
    });
    assert.deepEqual(browser.viewport, { width: 1280, height: 720, deviceScaleFactor: 2 });
  });
});

test('loadCliConfig 应兼容把 RuntimeConfig 写在配置根对象，并将 ffmpeg 字符串转为 { ffmpeg: { path } }', async () => {
  await withTempCwd(async (cwd) => {
    const configPath = join(cwd, 'tutolang.config.ts');
    await writeFile(
      configPath,
      `export default {
  language: 'zh',
  renderVideo: true,
  cacheDir: '.tutolang-cache',
  ffmpeg: 'ffmpeg',
} as const;`,
      'utf-8',
    );

    const loaded = await loadCliConfig();
    assert.equal(loaded.path, configPath);
    assert.equal(loaded.config.language, 'zh');
    assert.equal(loaded.config.runtime?.renderVideo, true);
    assert.equal(loaded.config.runtime?.cacheDir, '.tutolang-cache');
    assert.equal(loaded.config.runtime?.ffmpeg?.path, 'ffmpeg');
  });
});

test('loadCliConfig 在 recording.argsTemplate 缺省时应从 TUTOLANG_RECORD_ARGS_JSON 读取', async () => {
  const previous = process.env.TUTOLANG_RECORD_ARGS_JSON;
  process.env.TUTOLANG_RECORD_ARGS_JSON = JSON.stringify(['-y', '{output}']);
  try {
    await withTempCwd(async (cwd) => {
      const configPath = join(cwd, 'tutolang.config.ts');
      await writeFile(
        configPath,
        `export default {
  executors: {
    code: {
      type: 'vscode',
      recording: {
        outputDir: 'dist/captures',
      },
    },
  },
} as const;`,
        'utf-8',
      );

      const loaded = await loadCliConfig();
      assert.equal(loaded.path, configPath);
      const code = loaded.config.executors?.code;
      assert.ok(code && code.type === 'vscode');
      assert.deepEqual(code.recording?.argsTemplate, ['-y', '{output}']);
    });
  } finally {
    if (previous === undefined) delete process.env.TUTOLANG_RECORD_ARGS_JSON;
    else process.env.TUTOLANG_RECORD_ARGS_JSON = previous;
  }
});

test('loadCliConfig 应支持 JSON 配置文件', async () => {
  await withTempCwd(async (cwd) => {
    const configPath = join(cwd, 'tutolang.config.json');
    await writeFile(
      configPath,
      JSON.stringify({ language: 'zh', runtime: { renderVideo: true } }, null, 2),
      'utf-8',
    );
    const loaded = await loadCliConfig();
    assert.equal(loaded.path, configPath);
    assert.equal(loaded.config.language, 'zh');
    assert.equal(loaded.config.runtime?.renderVideo, true);
  });
});
