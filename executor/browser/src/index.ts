import type { BrowserExecutor } from '@tutolang/types';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export type PuppeteerExecutorOptions = {
  headless?: boolean;
  executablePath?: string;
  screenshotDir?: string;
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
    throw new Error('浏览器录屏暂未实现（当前仅支持截图预览）');
  }

  async stopRecording(): Promise<string> {
    throw new Error('浏览器录屏暂未实现（当前仅支持截图预览）');
  }

  private getPageOrThrow(): PuppeteerPage {
    if (!this.page) {
      throw new Error('浏览器尚未初始化：请先调用 initialize()');
    }
    return this.page;
  }
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
  screenshot(options: { path: string; fullPage?: boolean }): Promise<void>;
  setViewport(viewport: { width: number; height: number; deviceScaleFactor?: number }): Promise<void>;
  close(): Promise<void>;
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
