import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { CodeExecutor } from '@tutolang/types';
import { Runtime } from '../index.ts';

class FakeCodeExecutor implements CodeExecutor {
  name = 'fake';
  calls: Array<{ method: string; args: unknown[] }> = [];

  async initialize(): Promise<void> {}

  async cleanup(): Promise<void> {}

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

  async deleteLeft(count: number, options?: { delayMs?: number }): Promise<void> {
    this.calls.push({ method: 'deleteLeft', args: [count, options] });
  }

  async deleteRight(count: number, options?: { delayMs?: number }): Promise<void> {
    this.calls.push({ method: 'deleteRight', args: [count, options] });
  }

  async deleteLine(count = 1, options?: { delayMs?: number }): Promise<void> {
    this.calls.push({ method: 'deleteLine', args: [count, options] });
  }

  async highlightLine(lineNumber: number, options?: { durationMs?: number }): Promise<void> {
    this.calls.push({ method: 'highlightLine', args: [lineNumber, options] });
  }

  async moveCursor(line: number, column: number): Promise<void> {
    this.calls.push({ method: 'moveCursor', args: [line, column] });
  }

  async saveFile(): Promise<void> {
    this.calls.push({ method: 'saveFile', args: [] });
  }

  async startRecording(): Promise<void> {}

  async stopRecording(): Promise<string> {
    return '';
  }
}

test('Runtime.commit 在配置 codeExecutor 时应基于 git diff 做字符级编辑（不重写整行）', async () => {
  if (!(await hasGit())) return;

  const repoDir = await mkdtemp(join(tmpdir(), 'tutolang-git-diff-apply-test-'));
  await git(repoDir, ['init']);
  await git(repoDir, ['config', 'user.name', 'tutolang-test']);
  await git(repoDir, ['config', 'user.email', 'tutolang-test@example.com']);

  const filePath = join(repoDir, 'demo.txt');
  const beforeLine = `${'a'.repeat(6)}${'b'.repeat(14)}zz`;
  const afterLine = `${'a'.repeat(6)}${'c'.repeat(14)}zz`;

  await writeFile(filePath, `${beforeLine}\n`, 'utf-8');
  await git(repoDir, ['add', '.']);
  await git(repoDir, ['commit', '-m', 'v1']);
  const commitV1 = (await git(repoDir, ['rev-parse', 'HEAD'])).trim();

  await writeFile(filePath, `${afterLine}\n`, 'utf-8');
  await git(repoDir, ['add', '.']);
  await git(repoDir, ['commit', '-m', 'v2']);
  const commitV2 = (await git(repoDir, ['rev-parse', 'HEAD'])).trim();

  const runtime = new Runtime({ renderVideo: false, projectDir: repoDir });
  const executor = new FakeCodeExecutor();
  runtime.setCodeExecutor(executor);

  const originalLog = console.log;
  console.log = () => undefined;
  try {
    await runtime.commit(commitV1);
    await runtime.commit(commitV2);
  } finally {
    console.log = originalLog;
    await runtime.cleanup();
  }

  assert.ok(!executor.calls.some((call) => call.method === 'writeLine'), '不应通过 writeLine 重写整行');

  const deleteCall = executor.calls.find((call) => call.method === 'deleteRight');
  assert.ok(deleteCall, '应删除旧的变化片段');
  assert.equal(deleteCall.args[0], 14, '应只删除变化的字符范围');

  const insertCall = executor.calls.find((call) => call.method === 'writeChar');
  assert.ok(insertCall, '应输入新的变化片段');
  assert.equal(insertCall.args[0], 'c'.repeat(14));
});

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

