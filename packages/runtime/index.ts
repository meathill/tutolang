import type { RuntimeConfig, CodeExecutor, BrowserExecutor } from '@tutolang/types';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

/**
 * Runtime MVP：以日志形式记录动作，方便验证编译输出。
 */
export class Runtime {
  private config: RuntimeConfig;
  private codeExecutor?: CodeExecutor;
  private browserExecutor?: BrowserExecutor;
  private videoSegments: string[] = [];
  private actions: string[] = [];
  private tempDir?: string;

  constructor(config: RuntimeConfig = {}) {
    this.config = {
      renderVideo: false,
      ...config,
    };
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
    await this.createSlide(content);
  }

  async file(path: string, options?: { mode?: 'i' | 'e' }): Promise<void> {
    this.log('file', `${path} mode=${options?.mode ?? '-'}`);
    if (this.codeExecutor) {
      await this.codeExecutor.openFile(path);
    }
    await this.createSlide(`文件：${path} 模式：${options?.mode ?? '-'}`);
  }

  async fileEnd(path: string): Promise<void> {
    this.log('fileEnd', path);
    await this.createSlide(`文件结束：${path}`, 1.2);
  }

  async inputLine(path: string, lineNumber?: number, text?: string): Promise<void> {
    this.log('inputLine', `${path}:${lineNumber ?? '?'} ${text ?? ''}`.trim());
    if (this.codeExecutor) {
      await this.codeExecutor.writeLine(text ?? '', lineNumber);
    }
    await this.createSlide(`输入 ${path}:${lineNumber ?? '?'}\n${text ?? ''}`, 1.4);
  }

  async editLine(path: string, lineNumber: number, text?: string): Promise<void> {
    this.log('editLine', `${path}:${lineNumber} ${text ?? ''}`.trim());
    if (this.codeExecutor) {
      await this.codeExecutor.writeLine(text ?? '', lineNumber);
    }
    await this.createSlide(`编辑 ${path}:${lineNumber}\n${text ?? ''}`, 1.4);
  }

  async highlight(selector: string): Promise<void> {
    this.log('highlight', selector);
    if (this.browserExecutor) {
      await this.browserExecutor.highlight(selector);
    }
    await this.createSlide(`高亮 ${selector}`, 1);
  }

  async click(selector: string): Promise<void> {
    this.log('click', selector);
    if (this.browserExecutor) {
      await this.browserExecutor.click(selector);
    }
    await this.createSlide(`点击 ${selector}`, 1);
  }

  async browser(path: string): Promise<void> {
    this.log('browser', path);
    if (this.browserExecutor) {
      await this.browserExecutor.navigate(path);
    }
    await this.createSlide(`浏览：${path}`, 1.2);
  }

  async browserEnd(path: string): Promise<void> {
    this.log('browserEnd', path);
    await this.createSlide(`浏览结束：${path}`, 1);
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
    if (!this.config.renderVideo) return;
    if (!this.videoSegments.length) {
      await this.createSlide('暂无内容', 1);
    }
    await this.ensureTempDir();
    const listPath = join(this.tempDir!, 'concat.txt');
    const listContent = this.videoSegments.map((p) => `file ${p}`).join('\n');
    await writeFile(listPath, listContent, 'utf-8');
    await this.runFFmpeg([
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listPath,
      '-c',
      'copy',
      outputPath,
    ]);
  }

  private log(action: string, message: string): void {
    const line = `[${action}] ${message}`;
    this.actions.push(line);
    // MVP：直接输出，便于人工观察
    console.log(line);
  }

  private async createSlide(text: string, duration = 2): Promise<void> {
    if (!this.config.renderVideo) return;
    await this.ensureTempDir();
    const segmentPath = join(this.tempDir!, `${this.videoSegments.length.toString().padStart(4, '0')}.mp4`);
    const normalized = text.replace(/\r\n/g, '\n');
    const textFile = `${segmentPath}.txt`;
    await writeFile(textFile, normalized, 'utf-8');
    const font = '/System/Library/Fonts/Supplemental/Arial.ttf';
    const draw = `drawtext=fontfile=${font}:textfile=${textFile.replace(/:/g, '\\:')}:fontcolor=white:fontsize=32:box=1:boxcolor=0x00000099:boxborderw=20:x=(w-text_w)/2:y=(h-text_h)/2:line_spacing=6`;
    await this.runFFmpeg([
      '-y',
      '-f',
      'lavfi',
      '-i',
      `color=size=${this.config.screen?.width ?? 1280}x${this.config.screen?.height ?? 720}:duration=${duration}:rate=30:color=black`,
      '-vf',
      draw,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      segmentPath,
    ]);
    this.videoSegments.push(segmentPath);
  }

  private async ensureTempDir(): Promise<void> {
    if (!this.tempDir) {
      if (this.config.tempDir) {
        this.tempDir = this.config.tempDir;
      } else {
        this.tempDir = await mkdtemp(join(tmpdir(), 'tutolang-'));
      }
    }
  }

  private runFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', ['-loglevel', 'error', ...args], { stdio: 'inherit' });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
    });
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
