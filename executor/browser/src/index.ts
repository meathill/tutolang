import type { BrowserExecutor } from '@tutolang/types';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';

export type PuppeteerExecutorOptions = {
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

export class PuppeteerExecutor implements BrowserExecutor {
  name = 'browser';
  private options: PuppeteerExecutorOptions;
  private browser?: PuppeteerBrowser;
  private page?: PuppeteerPage;
  private screenshotIndex = 0;
  private recording?: {
    session: PuppeteerCDPSession;
    onFrame: (payload: ScreencastFrameEvent) => void;
    outputDir: string;
    framesDir: string;
    format: 'jpeg' | 'png';
    extension: string;
    fps: number;
    lastWrite: Promise<void>;
    frameCount: number;
    startedAtMs: number;
  };

  constructor(options: PuppeteerExecutorOptions = {}) {
    this.options = options;
  }

  async initialize(): Promise<void> {
    const puppeteer = await loadPuppeteerModule();
    const browser = await puppeteer.launch({
      headless: this.options.headless ?? true,
      executablePath: this.options.executablePath,
    });
    const page = await browser.newPage();
    const viewport = this.options.viewport;
    if (viewport?.width && viewport?.height) {
      await page.setViewport({
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.deviceScaleFactor,
      });
    }

    this.browser = browser;
    this.page = page;
  }

  async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = undefined;
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
    }
  }

  async navigate(url: string): Promise<void> {
    const page = this.getPageOrThrow();
    await page.goto(url);
  }

  async click(selector: string): Promise<void> {
    const page = this.getPageOrThrow();
    await page.click(selector);
  }

  async type(selector: string, text: string): Promise<void> {
    const page = this.getPageOrThrow();
    await page.type(selector, text, { delay: 20 });
  }

  async highlight(selector: string): Promise<void> {
    const page = this.getPageOrThrow();
    await page.evaluate((sel) => {
      const element = document.querySelector(sel);
      if (!element) return;
      element.scrollIntoView({ block: 'center', inline: 'center' });
      const htmlElement = element as HTMLElement;
      htmlElement.style.outline = '4px solid #ff0033';
      htmlElement.style.outlineOffset = '2px';
    }, selector);
  }

  async screenshot(): Promise<string> {
    const page = this.getPageOrThrow();
    const dir = this.options.screenshotDir ? resolve(this.options.screenshotDir) : resolve(process.cwd(), 'dist', 'browser-captures');
    await mkdir(dir, { recursive: true });
    const fileName = `${Date.now()}-${String(this.screenshotIndex).padStart(4, '0')}.png`;
    this.screenshotIndex += 1;
    const path = join(dir, fileName);
    await page.screenshot({ path, fullPage: true });
    return path;
  }

  async startRecording(): Promise<void> {
    if (this.recording) {
      throw new Error('浏览器录制已在进行中');
    }

    const page = this.getPageOrThrow();
    const recordingOptions = this.options.recording;

    const outputDir = recordingOptions?.outputDir
      ? resolve(recordingOptions.outputDir)
      : resolve(process.cwd(), 'dist', 'browser-recordings');
    await mkdir(outputDir, { recursive: true });

    const framesDir = join(outputDir, `frames-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await mkdir(framesDir, { recursive: true });

    const format = recordingOptions?.format ?? 'jpeg';
    const extension = format === 'jpeg' ? 'jpg' : 'png';
    const fps = normalizePositiveInt(recordingOptions?.fps) ?? 30;
    const quality = normalizeJpegQuality(recordingOptions?.quality) ?? 80;

    const session = await page.target().createCDPSession();

    const recording = {
      session,
      onFrame: (_payload: ScreencastFrameEvent) => undefined,
      outputDir,
      framesDir,
      format,
      extension,
      fps,
      lastWrite: Promise.resolve(),
      frameCount: 0,
      startedAtMs: 0,
    };

    recording.onFrame = (payload: ScreencastFrameEvent) => {
      void session.send('Page.screencastFrameAck', { sessionId: payload.sessionId });
      const frameIndex = recording.frameCount;
      recording.frameCount += 1;
      const fileName = `${String(frameIndex).padStart(6, '0')}.${recording.extension}`;
      const filePath = join(recording.framesDir, fileName);
      const buffer = Buffer.from(payload.data, 'base64');
      recording.lastWrite = recording.lastWrite.then(() => writeFile(filePath, buffer));
    };

    session.on('Page.screencastFrame', recording.onFrame as unknown as (payload: unknown) => void);
    await session.send('Page.startScreencast', {
      format,
      ...(format === 'jpeg' ? { quality } : {}),
      everyNthFrame: 1,
    });

    recording.startedAtMs = Date.now();
    this.recording = recording;
  }

  async stopRecording(): Promise<string> {
    const recording = this.recording;
    if (!recording) {
      throw new Error('浏览器录制尚未开始');
    }
    this.recording = undefined;

    const stoppedAtMs = Date.now();
    try {
      recording.session.off('Page.screencastFrame', recording.onFrame as unknown as (payload: unknown) => void);
      await recording.session.send('Page.stopScreencast');
    } catch {
      // ignore
    }

    await recording.lastWrite;

    if (recording.frameCount === 0) {
      const page = this.getPageOrThrow();
      const fallbackPath = join(recording.framesDir, `000000.${recording.extension}`);
      await page.screenshot({
        path: fallbackPath,
        fullPage: false,
        ...(recording.format === 'jpeg'
          ? { type: 'jpeg', quality: normalizeJpegQuality(this.options.recording?.quality) ?? 80 }
          : { type: 'png' }),
      });
      recording.frameCount = 1;
    }

    const ffmpegPath = this.options.recording?.ffmpegPath ?? 'ffmpeg';
    const capturePath = join(recording.outputDir, `${Date.now()}-browser-capture.mp4`);

    const durationSeconds = Math.max(0.001, (stoppedAtMs - recording.startedAtMs) / 1000);
    const estimatedInputFps = recording.frameCount / durationSeconds;
    const inputFps = clamp(estimatedInputFps, 1, recording.fps);

    const inputPattern = join(recording.framesDir, `%06d.${recording.extension}`);
    await runCommand(ffmpegPath, [
      '-y',
      '-framerate',
      `${roundTo(inputFps, 3)}`,
      '-i',
      inputPattern,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-r',
      `${recording.fps}`,
      '-movflags',
      '+faststart',
      capturePath,
    ]);

    try {
      await recording.session.detach();
    } catch {
      // ignore
    }

    return capturePath;
  }

  private getPageOrThrow(): PuppeteerPage {
    if (!this.page) {
      throw new Error('浏览器尚未初始化：请先调用 initialize()');
    }
    return this.page;
  }
}

function normalizePositiveInt(value: unknown): number | undefined {
  if (typeof value !== 'number') return undefined;
  if (!Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  if (rounded <= 0) return undefined;
  return rounded;
}

function normalizeJpegQuality(value: unknown): number | undefined {
  if (typeof value !== 'number') return undefined;
  if (!Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  return Math.min(100, Math.max(1, rounded));
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function runCommand(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('error', rejectPromise);
    child.on('exit', (code, signal) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`${command} 执行失败（code=${code ?? 'null'} signal=${signal ?? 'null'}）`));
    });
  });
}

type PuppeteerLaunchOptions = {
  headless?: boolean;
  executablePath?: string;
};

type PuppeteerModule = {
  launch(options?: PuppeteerLaunchOptions): Promise<PuppeteerBrowser>;
};

type PuppeteerBrowser = {
  newPage(): Promise<PuppeteerPage>;
  close(): Promise<void>;
};

type PuppeteerPage = {
  goto(url: string): Promise<void>;
  click(selector: string): Promise<void>;
  type(selector: string, text: string, options?: { delay?: number }): Promise<void>;
  evaluate(fn: (selector: string) => void, selector: string): Promise<void>;
  screenshot(options: { path: string; fullPage?: boolean; type?: 'png' | 'jpeg'; quality?: number }): Promise<void>;
  setViewport(viewport: { width: number; height: number; deviceScaleFactor?: number }): Promise<void>;
  target(): PuppeteerTarget;
  close(): Promise<void>;
};

type PuppeteerTarget = {
  createCDPSession(): Promise<PuppeteerCDPSession>;
};

type PuppeteerCDPSession = {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
  on(event: string, listener: (payload: unknown) => void): void;
  off(event: string, listener: (payload: unknown) => void): void;
  detach(): Promise<void>;
};

type ScreencastFrameEvent = {
  data: string;
  sessionId: number;
  metadata?: Record<string, unknown>;
};

async function loadPuppeteerModule(): Promise<PuppeteerModule> {
  const fromPuppeteer = await tryImportPuppeteer('puppeteer');
  if (fromPuppeteer) return fromPuppeteer;
  const fromCore = await tryImportPuppeteer('puppeteer-core');
  if (fromCore) return fromCore;
  throw new Error('未找到 puppeteer/puppeteer-core：请先安装依赖（例如 pnpm -w add -D puppeteer）');
}

async function tryImportPuppeteer(moduleName: string): Promise<PuppeteerModule | undefined> {
  try {
    const mod = (await import(moduleName)) as unknown;
    const unwrapped = unwrapModuleDefault(mod);
    if (isPuppeteerModule(unwrapped)) return unwrapped;
    return undefined;
  } catch {
    return undefined;
  }
}

function unwrapModuleDefault(mod: unknown): unknown {
  if (!mod || typeof mod !== 'object') return mod;
  const record = mod as Record<string, unknown>;
  if ('default' in record) return record.default;
  return mod;
}

function isPuppeteerModule(value: unknown): value is PuppeteerModule {
  if (!isRecord(value)) return false;
  return typeof value.launch === 'function';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
