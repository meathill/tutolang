import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { BrowserExecutor } from '@tutolang/types';
import { Runtime } from '../index.ts';

class CapturingBrowserExecutor implements BrowserExecutor {
  name = 'capture-browser';
  lastNavigateUrl: string | undefined;

  async initialize(): Promise<void> {}

  async cleanup(): Promise<void> {}

  async navigate(url: string): Promise<void> {
    this.lastNavigateUrl = url;
  }

  async click(_selector: string): Promise<void> {}

  async type(_selector: string, _text: string): Promise<void> {}

  async highlight(_selector: string): Promise<void> {}

  async screenshot(): Promise<string> {
    return '';
  }

  async startRecording(): Promise<void> {}

  async stopRecording(): Promise<string> {
    return '';
  }
}

test('Runtime.commit 应使用 worktree 切换源码目录，并在 cleanup 后恢复 projectDir', async () => {
  if (!(await hasGit())) {
    return;
  }

  const repoDir = await mkdtemp(join(tmpdir(), 'tutolang-git-runtime-test-'));
  await git(repoDir, ['init']);
  await git(repoDir, ['config', 'user.name', 'tutolang-test']);
  await git(repoDir, ['config', 'user.email', 'tutolang-test@example.com']);

  const indexPath = join(repoDir, 'index.html');
  await writeFile(indexPath, '<!doctype html><title>v1</title>', 'utf-8');
  await git(repoDir, ['add', '.']);
  await git(repoDir, ['commit', '-m', 'v1']);
  const commitV1 = (await git(repoDir, ['rev-parse', 'HEAD'])).trim();

  await writeFile(indexPath, '<!doctype html><title>v2</title>', 'utf-8');
  await git(repoDir, ['add', '.']);
  await git(repoDir, ['commit', '-m', 'v2']);
  const commitV2 = (await git(repoDir, ['rev-parse', 'HEAD'])).trim();

  const runtime = new Runtime({ renderVideo: false, projectDir: repoDir });
  const browser = new CapturingBrowserExecutor();
  runtime.setBrowserExecutor(browser);

  await runtime.browser('index.html');
  const headPath = resolveNavigatedFilePath(browser);
  assert.ok(headPath.startsWith(repoDir), '未切换 commit 前应使用原仓库路径');
  assert.equal(await readFile(headPath, 'utf-8'), '<!doctype html><title>v2</title>');

  await runtime.commit(commitV1);
  await runtime.browser('index.html');
  const v1Path = resolveNavigatedFilePath(browser);
  assert.ok(!v1Path.startsWith(repoDir), '切换 commit 后应使用 worktree 路径');
  assert.equal(await readFile(v1Path, 'utf-8'), '<!doctype html><title>v1</title>');

  const worktreeDir = dirname(v1Path);
  await writeFile(join(worktreeDir, 'dirty.txt'), 'dirty', 'utf-8');

  await runtime.commit(commitV2);
  await runtime.browser('index.html');
  const v2Path = resolveNavigatedFilePath(browser);
  assert.equal(await readFile(v2Path, 'utf-8'), '<!doctype html><title>v2</title>');
  await assert.rejects(() => readFile(join(worktreeDir, 'dirty.txt'), 'utf-8'), /ENOENT/, '切换 commit 后应移除旧 worktree');

  await runtime.cleanup();
  await runtime.browser('index.html');
  const restoredPath = resolveNavigatedFilePath(browser);
  assert.ok(restoredPath.startsWith(repoDir), 'cleanup 后应恢复为原仓库路径');
  assert.equal(await readFile(restoredPath, 'utf-8'), '<!doctype html><title>v2</title>');
});

function resolveNavigatedFilePath(executor: CapturingBrowserExecutor): string {
  const url = executor.lastNavigateUrl;
  assert.ok(url, '应调用 navigate(url)');
  assert.ok(url.startsWith('file://'), `navigate 期望 file:// URL，实际是 ${url}`);
  return fileURLToPath(url);
}

async function hasGit(): Promise<boolean> {
  try {
    await runCommand('git', ['--version']);
    return true;
  } catch {
    return false;
  }
}

async function git(repoDir: string, args: string[]): Promise<string> {
  return await runCommand('git', ['-C', repoDir, ...args]);
}

async function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', rejectPromise);
    child.on('exit', (code, signal) => {
      if (code === 0) resolvePromise(stdout);
      else rejectPromise(new Error(`${command} 执行失败（code=${code ?? 'null'} signal=${signal ?? 'null'}）：${stderr.trim()}`));
    });
  });
}

