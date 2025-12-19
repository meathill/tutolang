import type { TutolangOptions, RuntimeConfig, CodeExecutor, BrowserExecutor } from '@tutolang/types';
import { Compiler } from '@tutolang/compiler';
import { Runtime } from '@tutolang/runtime';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, extname, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

export default class TutolangCore {
  private compiler: Compiler;
  private options: TutolangOptions;

  constructor(options: TutolangOptions) {
    this.options = options;
    this.compiler = new Compiler();
  }

  async compile(code: string): Promise<string> {
    return this.compiler.compile(code);
  }

  async execute(code: string, options?: { runtimeConfig?: RuntimeConfig; output?: string }): Promise<void> {
    const compiled = await this.compiler.compile(code);
    const url = this.bufferToModule(compiled);
    const mod = await import(url);
    const runner = resolveRunner(mod);
    const runtime = new Runtime({ renderVideo: true, ...options?.runtimeConfig });
    if (typeof runner !== 'function') return;
    try {
      await runner(runtime, { output: options?.output });
    } finally {
      await runtime.cleanup();
    }
  }

  async compileFile(inputPath: string, outputPath: string): Promise<void> {
    const code = await readFile(inputPath, 'utf-8');
    const compiled = await this.compiler.compile(code);
    const target = this.resolveOutputPath(inputPath, outputPath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, compiled, 'utf-8');
  }

  async executeFile(
    inputPath: string,
    outputPath: string,
    outputVideo?: string,
    options?: { runtimeConfig?: RuntimeConfig; codeExecutor?: CodeExecutor; browserExecutor?: BrowserExecutor },
  ): Promise<void> {
    const code = await readFile(inputPath, 'utf-8');
    const compiled = await this.compiler.compile(code);
    const target = this.resolveOutputPath(inputPath, outputPath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, compiled, 'utf-8');
    const url = pathToFileURL(target).href;
    const mod = await import(url);
    const runner = resolveRunner(mod);
    const runtime = new Runtime({
      renderVideo: true,
      projectDir: dirname(inputPath),
      ...options?.runtimeConfig,
    });

    if (options?.codeExecutor) runtime.setCodeExecutor(options.codeExecutor);
    if (options?.browserExecutor) runtime.setBrowserExecutor(options.browserExecutor);

    if (typeof runner !== 'function') return;

    const executors: Array<CodeExecutor | BrowserExecutor> = [];
    if (options?.codeExecutor) executors.push(options.codeExecutor);
    if (options?.browserExecutor) executors.push(options.browserExecutor);

    const initialized: Array<CodeExecutor | BrowserExecutor> = [];
    try {
      for (const executor of executors) {
        await executor.initialize();
        initialized.push(executor);
      }
      await runner(runtime, { output: outputVideo });
    } finally {
      for (const executor of initialized.reverse()) {
        await executor.cleanup();
      }
      await runtime.cleanup();
    }
  }

  private resolveOutputPath(inputPath: string, outputPath: string): string {
    const isFile = extname(outputPath) !== '';
    if (isFile) return outputPath;
    const base = basename(inputPath, extname(inputPath));
    return join(outputPath, `${base}.ts`);
  }

  private bufferToModule(code: string): string {
    const encoded = Buffer.from(code, 'utf-8').toString('base64');
    return `data:text/javascript;base64,${encoded}`;
  }
}

type RunnerOptions = { output?: string };
type Runner = (runtime: Runtime, options?: RunnerOptions) => unknown | Promise<unknown>;

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
