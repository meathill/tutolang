import type { CodeExecutor } from '@tutolang/types';
import { resolve } from 'node:path';
import type { CodeExecutorConfig, VSCodeCodeExecutorConfig } from './config-loader.ts';

type VSCodeExecutorModule = typeof import('../vscode-executor/index.ts');

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

async function loadVSCodeExecutor(): Promise<VSCodeExecutorModule> {
  try {
    return (await import('@tutolang/vscode-executor')) as VSCodeExecutorModule;
  } catch {
    return (await import('../vscode-executor/index.ts')) as VSCodeExecutorModule;
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

