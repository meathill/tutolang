import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Compiler } from '@tutolang/compiler';
import { Runtime } from '@tutolang/runtime';

const SAMPLE_PATH = join(process.cwd(), 'sample', 'hello-world.tutolang');

describe('Compiler + Runtime MVP', () => {
  it('compile 应生成包含 run 的可执行 TS 代码', async () => {
    const compiler = new Compiler();
    const code = await readFile(SAMPLE_PATH, 'utf-8');
    const output = await compiler.compile(code);
    assert.match(output, /export async function run/);
    assert.match(output, /runtime\.say/, '应该包含 runtime.say 调用');
  });

  it('run 执行后应记录关键动作', async () => {
    const compiler = new Compiler();
    const code = await readFile(SAMPLE_PATH, 'utf-8');
    const compiled = await compiler.compile(code);

    const dir = join(process.cwd(), 'tests', '.tmp');
    await mkdir(dir, { recursive: true });
    const target = join(dir, 'hello-world.ts');
    await writeFile(target, compiled, 'utf-8');

    const url = pathToFileURL(target).href;
    const mod = await import(url);
    const run = resolveRunner(mod);
    assert.equal(typeof run, 'function', '编译产物应导出可执行的 run()');
    const runtime = new Runtime();
    await run(runtime);
    const actions = runtime.getActions();

    assert.ok(
      actions.find((a) => a.includes('[say] Hello, everyone!')),
      '缺少开场解说',
    );
    assert.ok(
      actions.find((a) => a.includes('[inputLine] index.html:1')),
      '缺少文件输入行动作',
    );
    assert.ok(
      actions.find((a) => a.includes('[highlight] h1')),
      '缺少浏览器高亮动作',
    );
    assert.ok(
      actions.find((a) => a.includes('like and subscribe')),
      '缺少收尾解说',
    );

    rmSync(target, { force: true });
  });
});

type Runner = (runtime: Runtime, options?: unknown) => unknown | Promise<unknown>;

function resolveRunner(mod: unknown): Runner | undefined {
  const record = isRecord(mod) ? mod : undefined;
  if (!record) return undefined;

  const direct = record.run;
  if (typeof direct === 'function') return direct as Runner;

  const def = record.default;
  if (typeof def === 'function') return def as Runner;

  if (!isRecord(def)) return undefined;
  const defRun = def.run;
  if (typeof defRun === 'function') return defRun as Runner;

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}
