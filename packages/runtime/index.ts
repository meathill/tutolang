import type { RuntimeConfig, CodeExecutor, BrowserExecutor } from '@tutolang/types';
import { mkdtemp, mkdir, open, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { TTS } from './tts.ts';

export { TTS } from './tts.ts';
export { DiskCache, resolveCacheRootDir } from './ai-cache.ts';

/**
 * Runtime MVP：以日志形式记录动作，方便验证编译输出。
 */
export class Runtime {
  private config: RuntimeConfig;
  private codeExecutor?: CodeExecutor;
  private browserExecutor?: BrowserExecutor;
  private videoSegments: string[] = [];
  private tts: TTS;
  private actions: string[] = [];
  private tempDir?: string;

  constructor(config: RuntimeConfig = {}) {
    this.config = {
      renderVideo: false,
      ...config,
    };
    this.tts = new TTS({ cacheDir: config.cacheDir, ...config.tts, tempDir: config.tempDir });
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
    const audioPath = await this.generateSpeechAudio(content);
    await this.createSlide(content, undefined, audioPath);
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
    const audioPath = await this.generateSpeechAudio(text);
    await this.createSlide(`输入 ${path}:${lineNumber ?? '?'}\n${text ?? ''}`, 1.4, audioPath);
  }

  async editLine(path: string, lineNumber: number, text?: string): Promise<void> {
    this.log('editLine', `${path}:${lineNumber} ${text ?? ''}`.trim());
    if (this.codeExecutor) {
      await this.codeExecutor.writeLine(text ?? '', lineNumber);
    }
    const audioPath = await this.generateSpeechAudio(text);
    await this.createSlide(`编辑 ${path}:${lineNumber}\n${text ?? ''}`, 1.4, audioPath);
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
    const target = outputPath || join(this.tempDir ?? process.cwd(), 'tutolang-output.mp4');
    this.log('merge', `${target} (${this.videoSegments.length} segments)`);
    if (!this.config.renderVideo) return;
    if (!this.videoSegments.length) {
      await this.createSlide('暂无内容', 1);
    }
    await this.ensureTempDir();
    const listPath = join(this.tempDir!, 'concat.txt');
    const listContent = this.videoSegments.map((p) => `file ${p}`).join('\n');
    await writeFile(listPath, listContent, 'utf-8');
    await this.runFFmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', target]);
  }

  private log(action: string, message: string): void {
    const line = `[${action}] ${message}`;
    this.actions.push(line);
    // MVP：直接输出，便于人工观察
    console.log(line);
  }

  private async generateSpeechAudio(text?: string): Promise<string | undefined> {
    if (!this.config.renderVideo) return undefined;
    const trimmed = text?.trim();
    if (!trimmed) return undefined;
    try {
      const audioPath = await this.tts.generate(trimmed);
      return audioPath ?? undefined;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[tts] 生成失败：${reason}`);
      return undefined;
    }
  }

  private async createSlide(text: string, duration?: number, audioPath?: string): Promise<void> {
    if (!this.config.renderVideo) return;
    await this.ensureTempDir();
    const segmentPath = join(this.tempDir!, `${this.videoSegments.length.toString().padStart(4, '0')}.mp4`);
    const normalized = text.replace(/\r\n/g, '\n');
    const textFile = `${segmentPath}.txt`;
    await writeFile(textFile, normalized, 'utf-8');
    const font = '/System/Library/Fonts/Supplemental/Arial.ttf';
    const draw = `drawtext=fontfile=${font}:textfile=${textFile.replace(/:/g, '\\:')}:fontcolor=white:fontsize=32:box=1:boxcolor=0x00000099:boxborderw=20:x=(w-text_w)/2:y=(h-text_h)/2:line_spacing=6`;
    let targetDuration = duration ?? 2;
    if (audioPath) {
      const audioDuration = await this.getMediaDuration(audioPath);
      if (audioDuration) {
        targetDuration = Math.max(targetDuration, audioDuration + 0.2);
      } else if (duration === undefined) {
        targetDuration = Math.max(targetDuration, this.estimateDuration(text));
      }
    } else if (duration === undefined) {
      targetDuration = this.estimateDuration(text);
    }

    const sampleRate = this.config.tts?.sampleRateHertz ?? 24000;

    const args: string[] = [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `color=size=${this.config.screen?.width ?? 1280}x${this.config.screen?.height ?? 720}:duration=${targetDuration}:rate=30:color=black`,
    ];

    if (audioPath) args.push('-i', audioPath);
    else args.push('-f', 'lavfi', '-i', `anullsrc=channel_layout=mono:sample_rate=${sampleRate}`);

    args.push('-vf', draw);

    args.push(
      '-af',
      `apad=whole_dur=${targetDuration}`,
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-c:v',
      'libx264',
      '-c:a',
      'aac',
      '-ac',
      '1',
      '-ar',
      `${sampleRate}`,
      '-pix_fmt',
      'yuv420p',
      '-shortest',
      segmentPath,
    );

    await this.runFFmpeg(args);
    this.videoSegments.push(segmentPath);
  }

  private async ensureTempDir(): Promise<void> {
    if (this.tempDir) return;
    if (this.config.tempDir) {
      await mkdir(this.config.tempDir, { recursive: true });
      this.tempDir = this.config.tempDir;
      return;
    }
    this.tempDir = await mkdtemp(join(tmpdir(), 'tutolang-'));
  }

  private async getMediaDuration(mediaPath: string): Promise<number | undefined> {
    const wavDuration = await this.getWavDuration(mediaPath);
    if (wavDuration) return wavDuration;
    try {
      const output = await this.runFFprobe([
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        mediaPath,
      ]);
      const duration = parseFloat(output.trim());
      return Number.isFinite(duration) ? duration : undefined;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[ffprobe] 无法获取时长：${reason}`);
      return undefined;
    }
  }

  private async getWavDuration(wavPath: string): Promise<number | undefined> {
    if (!wavPath.toLowerCase().endsWith('.wav')) return undefined;
    try {
      const handle = await open(wavPath, 'r');
      try {
        const header = Buffer.alloc(44);
        const result = await handle.read(header, 0, header.length, 0);
        if (result.bytesRead < header.length) return undefined;
        if (header.toString('ascii', 0, 4) !== 'RIFF') return undefined;
        if (header.toString('ascii', 8, 12) !== 'WAVE') return undefined;
        const byteRate = header.readUInt32LE(28);
        const dataSize = header.readUInt32LE(40);
        if (!byteRate || !dataSize) return undefined;
        const duration = dataSize / byteRate;
        return Number.isFinite(duration) ? duration : undefined;
      } finally {
        await handle.close();
      }
    } catch {
      return undefined;
    }
  }

  private estimateDuration(text: string): number {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const base = words ? words / 2.6 : 1.8;
    const rate = this.config.tts?.speakingRate ?? 1;
    const estimate = base / rate;
    return Math.min(Math.max(estimate, 1.8), 15);
  }

  private runFFprobe(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.getFFprobePath(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`ffprobe exited with code ${code}: ${stderr.trim()}`));
        }
      });
    });
  }

  private getFFmpegPath(): string {
    return this.config.ffmpeg?.path ?? 'ffmpeg';
  }

  private getFFprobePath(): string {
    return this.config.ffmpeg?.ffprobePath ?? 'ffprobe';
  }

  private runFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.getFFmpegPath(), ['-loglevel', 'error', ...args], { stdio: 'inherit' });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
    });
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
