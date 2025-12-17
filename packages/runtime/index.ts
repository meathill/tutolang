import type { RuntimeConfig, CodeExecutor, BrowserExecutor } from '@tutolang/types';

/**
 * Runtime MVP：以日志形式记录动作，方便验证编译输出。
 */
export class Runtime {
  private config: RuntimeConfig;
  private codeExecutor?: CodeExecutor;
  private browserExecutor?: BrowserExecutor;
  private videoSegments: string[] = [];
  private actions: string[] = [];

  constructor(config: RuntimeConfig = {}) {
    this.config = config;
  }

  setCodeExecutor(executor: CodeExecutor): void {
    this.codeExecutor = executor;
  }

  setBrowserExecutor(executor: BrowserExecutor): void {
    this.browserExecutor = executor;
  }

  getActions(): string[] {
    return [...this.actions];
  }

  async say(content: string, options?: { image?: string; video?: string; browser?: string }): Promise<void> {
    const extra = options ? ` ${JSON.stringify(options)}` : '';
    this.log('say', `${content}${extra}`);
  }

  async file(path: string, options?: { mode?: 'i' | 'e' }): Promise<void> {
    this.log('file', `${path} mode=${options?.mode ?? '-'}`);
    if (this.codeExecutor) {
      await this.codeExecutor.openFile(path);
    }
  }

  async fileEnd(path: string): Promise<void> {
    this.log('fileEnd', path);
  }

  async inputLine(path: string, lineNumber?: number, text?: string): Promise<void> {
    this.log('inputLine', `${path}:${lineNumber ?? '?'} ${text ?? ''}`.trim());
    if (this.codeExecutor) {
      await this.codeExecutor.writeLine(text ?? '', lineNumber);
    }
  }

  async editLine(path: string, lineNumber: number, text?: string): Promise<void> {
    this.log('editLine', `${path}:${lineNumber} ${text ?? ''}`.trim());
    if (this.codeExecutor) {
      await this.codeExecutor.writeLine(text ?? '', lineNumber);
    }
  }

  async highlight(selector: string): Promise<void> {
    this.log('highlight', selector);
    if (this.browserExecutor) {
      await this.browserExecutor.highlight(selector);
    }
  }

  async click(selector: string): Promise<void> {
    this.log('click', selector);
    if (this.browserExecutor) {
      await this.browserExecutor.click(selector);
    }
  }

  async browser(path: string): Promise<void> {
    this.log('browser', path);
    if (this.browserExecutor) {
      await this.browserExecutor.navigate(path);
    }
  }

  async browserEnd(path: string): Promise<void> {
    this.log('browserEnd', path);
  }

  async commit(commitHash: string): Promise<void> {
    this.log('commit', commitHash);
  }

  async video(path: string): Promise<void> {
    this.videoSegments.push(path);
    this.log('video', path);
  }

  async merge(outputPath: string): Promise<void> {
    this.log('merge', `${outputPath} (${this.videoSegments.length} segments)`);
  }

  private log(action: string, message: string): void {
    const line = `[${action}] ${message}`;
    this.actions.push(line);
    // MVP：直接输出，便于人工观察
    console.log(line);
  }
}

export class TTS {
  async generate(text: string, options?: any): Promise<string> {
    return `tts://${text.slice(0, 20)}${options ? JSON.stringify(options) : ''}`;
  }
}

export class VideoMerger {
  async merge(segments: string[], output: string): Promise<void> {
    console.log(`[merge] ${segments.length} -> ${output}`);
  }

  async addSubtitle(videoPath: string, subtitlePath: string): Promise<string> {
    console.log(`[subtitle] ${subtitlePath} -> ${videoPath}`);
    return `${videoPath}.with-subtitle`;
  }
}

export class GitHelper {
  async checkout(commitHash: string): Promise<void> {
    console.log(`[git] checkout ${commitHash}`);
  }

  async getDiff(from: string, to: string): Promise<string> {
    console.log(`[git] diff ${from}..${to}`);
    return '';
  }

  async getCurrentCommit(): Promise<string> {
    console.log('[git] current');
    return '';
  }
}
