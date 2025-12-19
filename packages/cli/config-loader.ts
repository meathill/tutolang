import { access, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { RuntimeConfig } from '@tutolang/types';

export type VSCodeCodeExecutorConfig = {
  type: 'vscode';
  baseUrl?: string;
  token?: string;
  requestTimeoutMs?: number;
  typingDelayMs?: number;
  recording?: {
    ffmpegPath?: string;
    argsTemplate?: string[];
    outputDir?: string;
  };
};

export type CodeExecutorConfig = VSCodeCodeExecutorConfig | { type: 'none' };

export type PuppeteerBrowserExecutorConfig = {
  type: 'puppeteer';
  headless?: boolean;
  executablePath?: string;
  screenshotDir?: string;
  recording?: {
    ffmpegPath?: string;
    outputDir?: string;
    fps?: number;
    format?: 'jpeg' | 'png';
    quality?: number;
  };
  viewport?: {
    width?: number;
    height?: number;
    deviceScaleFactor?: number;
  };
};

export type BrowserExecutorConfig = PuppeteerBrowserExecutorConfig | { type: 'none' };

export type TutolangCliConfig = {
  language?: string;
  runtime?: RuntimeConfig;
  executors?: {
    code?: CodeExecutorConfig;
    browser?: BrowserExecutorConfig;
  };
};

export type LoadedCliConfig = {
  path?: string;
  config: TutolangCliConfig;
};

export async function loadCliConfig(explicitPath?: string): Promise<LoadedCliConfig> {
  const configPath = await resolveConfigPath(explicitPath);
  if (!configPath) return { config: {} };
  const raw = await loadConfigFromPath(configPath);
  const config = normalizeConfig(raw);
  return { path: configPath, config };
}

async function resolveConfigPath(explicitPath?: string): Promise<string | undefined> {
  if (explicitPath) return resolve(process.cwd(), explicitPath);

  const cwd = process.cwd();
  const home = homedir();

  const candidates = [
    resolve(cwd, 'tutolang.config.ts'),
    resolve(cwd, 'tutolang.config.js'),
    resolve(cwd, 'tutolang.config.mjs'),
    resolve(cwd, 'tutolang.config.cjs'),
    resolve(cwd, 'tutolang.config.json'),
    resolve(home, 'tutolang', 'config.ts'),
    resolve(home, 'tutolang', 'config.js'),
    resolve(home, 'tutolang', 'config.mjs'),
    resolve(home, 'tutolang', 'config.cjs'),
    resolve(home, 'tutolang', 'config.json'),
  ];

  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }
  return undefined;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function loadConfigFromPath(configPath: string): Promise<unknown> {
  const extension = extname(configPath).toLowerCase();
  if (extension === '.json') {
    const content = await readFile(configPath, 'utf-8');
    return JSON.parse(content) as unknown;
  }

  const url = pathToFileURL(configPath).href;
  const mod = (await import(url)) as unknown;
  return unwrapModuleDefault(mod);
}

function unwrapModuleDefault(mod: unknown): unknown {
  if (!mod || typeof mod !== 'object') return mod;
  const record = mod as Record<string, unknown>;
  if ('default' in record) return record.default;
  return mod;
}

function normalizeConfig(raw: unknown): TutolangCliConfig {
  if (!raw) return {};
  if (typeof raw !== 'object') {
    throw new Error(`配置文件导出值必须为对象，实际是 ${typeof raw}`);
  }

  const record = raw as Record<string, unknown>;
  const language = typeof record.language === 'string' ? record.language : undefined;
  const runtime = isPlainObject(record.runtime)
    ? (record.runtime as RuntimeConfig)
    : extractRuntimeConfigFromTopLevel(record);

  const executors = isPlainObject(record.executors) ? record.executors : undefined;
  const codeExecutor = executors && 'code' in executors ? normalizeCodeExecutor(executors.code) : undefined;
  const browserExecutor = executors && 'browser' in executors ? normalizeBrowserExecutor(executors.browser) : undefined;

  const normalizedExecutors: NonNullable<TutolangCliConfig['executors']> = {};
  if (codeExecutor) normalizedExecutors.code = codeExecutor;
  if (browserExecutor) normalizedExecutors.browser = browserExecutor;

  return {
    language,
    runtime,
    executors: Object.keys(normalizedExecutors).length > 0 ? normalizedExecutors : undefined,
  };
}

function extractRuntimeConfigFromTopLevel(record: Record<string, unknown>): RuntimeConfig | undefined {
  const keys: Array<keyof RuntimeConfig> = ['renderVideo', 'tempDir', 'projectDir', 'cacheDir', 'tts', 'ffmpeg', 'screen', 'output'];
  const runtime: RuntimeConfig = {};
  let hasAny = false;
  for (const key of keys) {
    if (!(key in record)) continue;
    if (key === 'ffmpeg' && typeof record.ffmpeg === 'string') {
      (runtime as Record<string, unknown>).ffmpeg = { path: record.ffmpeg };
    } else {
      (runtime as Record<string, unknown>)[key] = record[key as string];
    }
    hasAny = true;
  }
  return hasAny ? runtime : undefined;
}

function normalizeCodeExecutor(raw: unknown): CodeExecutorConfig | undefined {
  if (!raw) return undefined;
  if (typeof raw !== 'object') {
    throw new Error(`executors.code 必须为对象，实际是 ${typeof raw}`);
  }

  const record = raw as Record<string, unknown>;
  const typeValue = record.type;
  if (typeValue === 'none') return { type: 'none' };
  if (typeValue !== 'vscode') {
    throw new Error(`未知的 executors.code.type：${String(typeValue)}（当前仅支持 vscode/none）`);
  }

  const recording = isPlainObject(record.recording) ? (record.recording as Record<string, unknown>) : undefined;
  const recordingConfig =
    recording
      ? {
          ffmpegPath: typeof recording.ffmpegPath === 'string' ? recording.ffmpegPath : undefined,
          argsTemplate: normalizeRecordArgsTemplate(recording.argsTemplate),
          outputDir: typeof recording.outputDir === 'string' ? resolve(process.cwd(), recording.outputDir) : undefined,
        }
      : undefined;

  const mergedRecording =
    recordingConfig && (!recordingConfig.argsTemplate || recordingConfig.argsTemplate.length === 0)
      ? { ...recordingConfig, argsTemplate: readRecordArgsFromEnv() }
      : recordingConfig;

  return {
    type: 'vscode',
    baseUrl: typeof record.baseUrl === 'string' ? record.baseUrl : undefined,
    token: typeof record.token === 'string' ? record.token : undefined,
    requestTimeoutMs: typeof record.requestTimeoutMs === 'number' ? record.requestTimeoutMs : undefined,
    typingDelayMs: typeof record.typingDelayMs === 'number' ? record.typingDelayMs : undefined,
    recording: mergedRecording,
  };
}

function normalizeBrowserExecutor(raw: unknown): BrowserExecutorConfig | undefined {
  if (!raw) return undefined;
  if (typeof raw !== 'object') {
    throw new Error(`executors.browser 必须为对象，实际是 ${typeof raw}`);
  }

  const record = raw as Record<string, unknown>;
  const typeValue = record.type;
  if (typeValue === 'none') return { type: 'none' };
  if (typeValue !== 'puppeteer') {
    throw new Error(`未知的 executors.browser.type：${String(typeValue)}（当前仅支持 puppeteer/none）`);
  }

  const viewport = isPlainObject(record.viewport) ? (record.viewport as Record<string, unknown>) : undefined;
  const viewportConfig =
    viewport
      ? {
          width: typeof viewport.width === 'number' ? viewport.width : undefined,
          height: typeof viewport.height === 'number' ? viewport.height : undefined,
          deviceScaleFactor: typeof viewport.deviceScaleFactor === 'number' ? viewport.deviceScaleFactor : undefined,
        }
      : undefined;

  const recording = isPlainObject(record.recording) ? (record.recording as Record<string, unknown>) : undefined;
  const recordingConfig =
    recording
      ? {
          ffmpegPath: typeof recording.ffmpegPath === 'string' ? recording.ffmpegPath : undefined,
          outputDir: typeof recording.outputDir === 'string' ? resolve(process.cwd(), recording.outputDir) : undefined,
          fps: typeof recording.fps === 'number' ? recording.fps : undefined,
          format: recording.format === 'jpeg' || recording.format === 'png' ? recording.format : undefined,
          quality: typeof recording.quality === 'number' ? recording.quality : undefined,
        }
      : undefined;

  return {
    type: 'puppeteer',
    headless: typeof record.headless === 'boolean' ? record.headless : undefined,
    executablePath: typeof record.executablePath === 'string' ? record.executablePath : undefined,
    screenshotDir: typeof record.screenshotDir === 'string' ? resolve(process.cwd(), record.screenshotDir) : undefined,
    recording: recordingConfig,
    viewport: viewportConfig,
  };
}

function normalizeRecordArgsTemplate(raw: unknown): string[] | undefined {
  if (!raw) return undefined;
  if (!Array.isArray(raw)) {
    throw new Error('executors.code.recording.argsTemplate 必须为字符串数组');
  }
  const values = raw.map((item) => String(item));
  return values;
}

function readRecordArgsFromEnv(): string[] | undefined {
  const raw = process.env.TUTOLANG_RECORD_ARGS_JSON?.trim();
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
      throw new Error('TUTOLANG_RECORD_ARGS_JSON 需为 JSON 字符串数组');
    }
    return parsed;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`TUTOLANG_RECORD_ARGS_JSON 解析失败：${reason}`);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  return Object.getPrototypeOf(value) === Object.prototype;
}
