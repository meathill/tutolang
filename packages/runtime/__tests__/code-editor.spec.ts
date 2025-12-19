import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { CodeExecutor } from '@tutolang/types';
import { applyLineDiff } from '../code-editor.ts';

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

test('applyLineDiff 应仅删除并输入变化的字符片段（不重写整行）', async () => {
  const executor = new FakeCodeExecutor();
  const before = `${'a'.repeat(6)}${'b'.repeat(14)}zz`;
  const after = `${'a'.repeat(6)}${'c'.repeat(14)}zz`;

  await applyLineDiff(executor, { lineNumber: 1, before, after });

  assert.ok(!executor.calls.some((call) => call.method === 'writeLine'), '不应重写整行');

  const deleteCall = executor.calls.find((call) => call.method === 'deleteRight');
  assert.ok(deleteCall, '应删除旧的变化片段');
  assert.equal(deleteCall.args[0], 14, '应只删除变化的字符范围');

  const insertCall = executor.calls.find((call) => call.method === 'writeChar');
  assert.ok(insertCall, '应输入新的变化片段');
  assert.equal(insertCall.args[0], 'c'.repeat(14));
});

test('applyLineDiff 应能处理同一行的多段变更（保留中间未变部分）', async () => {
  const executor = new FakeCodeExecutor();
  const before = `aaaaaa${'b'.repeat(5)}zzzz${'c'.repeat(4)}`;
  const after = `aaaaaa${'B'.repeat(5)}zzzz${'C'.repeat(4)}`;

  await applyLineDiff(executor, { lineNumber: 3, before, after });

  const deleteCalls = executor.calls.filter((call) => call.method === 'deleteRight');
  assert.equal(deleteCalls.length, 2, '应拆成两段删除');
  assert.equal(deleteCalls[0]?.args[0], 5);
  assert.equal(deleteCalls[1]?.args[0], 4);

  const insertCalls = executor.calls.filter((call) => call.method === 'writeChar');
  assert.equal(insertCalls.length, 2, '应拆成两段输入');
  assert.equal(insertCalls[0]?.args[0], 'B'.repeat(5));
  assert.equal(insertCalls[1]?.args[0], 'C'.repeat(4));
});

