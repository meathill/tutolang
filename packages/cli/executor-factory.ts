import type { CodeExecutor, BrowserExecutor } from '@tutolang/types';
import { resolve } from 'node:path';
import type {
  BrowserExecutorConfig,
  CodeExecutorConfig,
  PuppeteerBrowserExecutorConfig,
  VSCodeCodeExecutorConfig,
} from './config-loader.ts';

type VSCodeExecutorModule = typeof import('../vscode-executor/index.ts');
type BrowserExecutorModule = typeof import('../../executor/browser/src/index.ts');

export async function createCodeExecutor(
  config: CodeExecutorConfig | undefined,
  options: { outputDir?: string } = {},
): Promise<CodeExecutor | undefined> {
  if (!config || config.type === 'none') return undefined;

  if (config.type === 'vscode') {
    const mod = await loadVSCodeExecutor();
    const { VSCodeExecutor } = mod;
    return new VSCodeExecutor(buildVSCodeOptions(config, options.outputDir));
  }

  return undefined;
}

export async function createBrowserExecutor(
  config: BrowserExecutorConfig | undefined,
  options: { outputDir?: string } = {},
): Promise<BrowserExecutor | undefined> {
  if (!config || config.type === 'none') return undefined;

  if (config.type === 'puppeteer') {
    const mod = await loadBrowserExecutor();
    const { PuppeteerExecutor } = mod;
    return new PuppeteerExecutor(buildBrowserOptions(config, options.outputDir));
  }

  return undefined;
}

async function loadVSCodeExecutor(): Promise<VSCodeExecutorModule> {
  try {
    return (await import('@tutolang/vscode-executor')) as VSCodeExecutorModule;
  } catch {
    return (await import('../vscode-executor/index.ts')) as VSCodeExecutorModule;
  }
}

async function loadBrowserExecutor(): Promise<BrowserExecutorModule> {
  try {
    return (await import('@tutolang/executor-browser')) as BrowserExecutorModule;
  } catch {
    return (await import('../../executor/browser/src/index.ts')) as BrowserExecutorModule;
  }
}

function buildVSCodeOptions(
  config: VSCodeCodeExecutorConfig,
  outputDir?: string,
): ConstructorParameters<VSCodeExecutorModule['VSCodeExecutor']>[0] {
  const recording = config.recording
    ? {
        ffmpegPath: config.recording.ffmpegPath,
        argsTemplate: config.recording.argsTemplate,
        outputDir: config.recording.outputDir ?? (outputDir ? resolve(outputDir, 'captures') : undefined),
      }
    : undefined;

  if (!recording?.argsTemplate || recording.argsTemplate.length === 0) {
    throw new Error('VSCode 录屏未配置 argsTemplate：请在配置中设置 executors.code.recording.argsTemplate 或设置 TUTOLANG_RECORD_ARGS_JSON。');
  }
  if (!recording.argsTemplate.includes('{output}')) {
    throw new Error('VSCode 录屏参数模板必须包含 {output} 占位符（用于替换输出文件路径）。');
  }

  return {
    baseUrl: config.baseUrl,
    token: config.token ?? process.env.TUTOLANG_VSCODE_TOKEN,
    requestTimeoutMs: config.requestTimeoutMs,
    typingDelayMs: config.typingDelayMs,
    recording,
  };
}

function buildBrowserOptions(
  config: PuppeteerBrowserExecutorConfig,
  outputDir?: string,
): ConstructorParameters<BrowserExecutorModule['PuppeteerExecutor']>[0] {
  return {
    headless: config.headless,
    executablePath: config.executablePath,
    viewport: config.viewport,
    screenshotDir: config.screenshotDir ?? (outputDir ? resolve(outputDir, 'browser-captures') : undefined),
    recording: config.recording
      ? {
          ffmpegPath: config.recording.ffmpegPath,
          outputDir: config.recording.outputDir ?? (outputDir ? resolve(outputDir, 'browser-recordings') : undefined),
          fps: config.recording.fps,
          format: config.recording.format,
          quality: config.recording.quality,
        }
      : undefined,
  };
}
