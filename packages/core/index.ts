import type { TutolangOptions, RuntimeConfig, CodeExecutor, BrowserExecutor } from '@tutolang/types';
import { Compiler } from '@tutolang/compiler';
import { Runtime } from '@tutolang/runtime';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, extname, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Tutolang Core
 * Main entry point that orchestrates compiler and runtime
 */
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
    const runner = (mod as any).run ?? (mod as any).default?.run ?? (mod as any).default;
    const runtime = new Runtime({ renderVideo: true, ...options?.runtimeConfig });
    if (typeof runner === 'function') {
      await runner(runtime, { output: options?.output });
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
    const runner = (mod as any).run ?? (mod as any).default?.run ?? (mod as any).default;
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
