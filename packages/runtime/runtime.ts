import type { RuntimeConfig, CodeExecutor, BrowserExecutor } from '@tutolang/types';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TTS } from './tts.ts';
import { resolveScriptPath, renderFilePreview, tryReadFileLines, type FileContext } from './file-preview.ts';
import { GitDiffApplier } from './git-diff-applier.ts';
import { GitWorktreeManager } from './git-worktree.ts';
import { MediaTools } from './media-tools.ts';
import { createImageSlideSegment, createSlideSegment, transcodeCaptureToSegment, type SlideOptions } from './video-segments.ts';

type RuntimeFileContext = FileContext & {
  typedLineCount: number;
};

export class Runtime {
  private config: RuntimeConfig;
  private codeExecutor?: CodeExecutor;
  private browserExecutor?: BrowserExecutor;
  private videoSegments: string[] = [];
  private tts: TTS;
  private actions: string[] = [];
  private tempDir?: string;
  private gitWorktree?: GitWorktreeManager;
  private gitDiffApplier?: GitDiffApplier;
  private currentCommitHash?: string;
  private fileContexts = new Map<string, RuntimeFileContext>();
  private media: MediaTools;

  constructor(config: RuntimeConfig = {}) {
    this.config = { renderVideo: false, ...config };
    this.tts = new TTS({ cacheDir: config.cacheDir, ...config.tts, tempDir: config.tempDir });
    this.media = new MediaTools(this.config);
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

  async cleanup(): Promise<void> {
    const manager = this.gitWorktree;
    if (!manager) return;
    this.gitWorktree = undefined;
    this.gitDiffApplier = undefined;
    this.currentCommitHash = undefined;
    this.config.projectDir = manager.getOriginalProjectDir();
    await manager.cleanup();
  }

  async say(content: string, options?: { image?: string; video?: string; browser?: string }): Promise<void> {
    const extra = options ? ` ${JSON.stringify(options)}` : '';
    this.log('say', `${content}${extra}`);
    const audioPath = await this.generateSpeechAudio(content);

    if (this.config.renderVideo && this.browserExecutor && options?.browser) {
      const shouldNavigate = options.browser.trim() !== '' && options.browser !== 'true';
      if (shouldNavigate) {
        const url = this.resolveBrowserTarget(options.browser);
        await this.browserExecutor.navigate(url);
      }
      await this.captureBrowserRecording({
        action: async () => undefined,
        minDuration: 1.2,
        audioPath,
        fallbackText: content,
      });
      return;
    }

    await this.createSlide(content, undefined, audioPath);
  }

  async file(path: string, options?: { mode?: 'i' | 'e' }): Promise<void> {
    const mode = options?.mode;
    this.log('file', `${path} mode=${mode ?? '-'}`);
    const resolvedPath = resolveScriptPath(this.config.projectDir, path);
    const shouldRecord = Boolean(this.config.renderVideo && this.codeExecutor && mode === 'i');
    if (this.codeExecutor) {
      await this.codeExecutor.openFile(resolvedPath, shouldRecord ? { createIfMissing: true, clear: true } : undefined);
    }

    let context: RuntimeFileContext | undefined;
    if (this.config.renderVideo) {
      const lines = await tryReadFileLines(resolvedPath);
      context = {
        displayPath: path,
        resolvedPath,
        mode,
        lines,
        revealedLineCount: mode === 'i' ? 0 : (lines?.length ?? 0),
        typedLineCount: mode === 'i' ? 0 : (lines?.length ?? 0),
      };
      this.fileContexts.set(path, context);
    }

    if (shouldRecord) return;

    const slideText =
      context?.lines && context.lines.length > 0
        ? renderFilePreview(context, { screenHeight: this.config.screen?.height })
        : `文件：${path} 模式：${mode ?? '-'}`;
    await this.createSlide(slideText, undefined, undefined, { layout: context?.lines?.length ? 'code' : 'center' });
  }

  async fileEnd(path: string): Promise<void> {
    this.log('fileEnd', path);
    const context = this.fileContexts.get(path);
    if (this.config.renderVideo && this.codeExecutor && context?.mode === 'i') {
      await this.flushRemainingFileLines(context);
      this.fileContexts.delete(path);
      return;
    }
    if (context?.lines && context.lines.length > 0) {
      context.revealedLineCount = context.lines.length;
      await this.createSlide(renderFilePreview(context, { screenHeight: this.config.screen?.height }), 1.2, undefined, {
        layout: 'code',
      });
    } else {
      await this.createSlide(`文件结束：${path}`, 1.2);
    }
    this.fileContexts.delete(path);
  }

  async inputLine(path: string, lineNumber?: number, text?: string): Promise<void> {
    this.log('inputLine', `${path}:${lineNumber ?? '?'} ${text ?? ''}`.trim());
    const context = this.fileContexts.get(path);
    if (this.config.renderVideo && this.codeExecutor && context?.mode === 'i' && lineNumber !== undefined) {
      await this.recordCodeSegment(context, lineNumber, text);
      return;
    }
    const codeLine =
      context?.lines && context.lines.length > 0 && lineNumber !== undefined
        ? context.lines[lineNumber - 1]
        : undefined;
    if (this.codeExecutor) {
      await this.codeExecutor.writeLine(codeLine ?? text ?? '', lineNumber);
    }
    const audioPath = await this.generateSpeechAudio(text);

    if (context?.lines && context.lines.length > 0 && lineNumber !== undefined) {
      if (context.mode === 'i') {
        const nextCount = Math.max(context.revealedLineCount, lineNumber);
        context.revealedLineCount = Math.min(nextCount, context.lines.length);
      } else {
        context.revealedLineCount = context.lines.length;
      }
      await this.createSlide(
        renderFilePreview(context, {
          highlightLine: lineNumber,
          narration: text,
          includeNarration: true,
          screenHeight: this.config.screen?.height,
        }),
        1.4,
        audioPath,
        { layout: 'code' },
      );
      return;
    }

    await this.createSlide(`输入 ${path}:${lineNumber ?? '?'}\n${text ?? ''}`, 1.4, audioPath);
  }

  async editLine(path: string, lineNumber: number, text?: string): Promise<void> {
    this.log('editLine', `${path}:${lineNumber} ${text ?? ''}`.trim());
    const context = this.fileContexts.get(path);
    const codeLine = context?.lines && context.lines.length > 0 ? context.lines[lineNumber - 1] : undefined;
    if (this.codeExecutor) {
      await this.codeExecutor.writeLine(codeLine ?? text ?? '', lineNumber);
    }
    const audioPath = await this.generateSpeechAudio(text);

    if (context?.lines && context.lines.length > 0) {
      context.revealedLineCount = context.lines.length;
      await this.createSlide(
        renderFilePreview(context, {
          highlightLine: lineNumber,
          narration: text,
          includeNarration: true,
          screenHeight: this.config.screen?.height,
        }),
        1.4,
        audioPath,
        { layout: 'code' },
      );
      return;
    }

    await this.createSlide(`编辑 ${path}:${lineNumber}\n${text ?? ''}`, 1.4, audioPath);
  }

  async highlight(selector: string, narration?: string): Promise<void> {
    this.log('highlight', selector);
    const audioPath = await this.generateSpeechAudio(narration);
    if (this.config.renderVideo && this.browserExecutor) {
      await this.captureBrowserRecording({
        action: async () => {
          await this.browserExecutor!.highlight(selector);
        },
        minDuration: narration ? 1.2 : 1,
        audioPath,
        afterActionDelayMs: 150,
        fallbackText: narration ? `高亮 ${selector}\n${narration}` : `高亮 ${selector}`,
      });
      return;
    }

    if (this.browserExecutor) {
      await this.browserExecutor.highlight(selector);
    }
    await this.createSlide(narration ? `高亮 ${selector}\n${narration}` : `高亮 ${selector}`, narration ? 1.2 : 1, audioPath);
  }

  async click(selector: string, narration?: string): Promise<void> {
    this.log('click', selector);
    const audioPath = await this.generateSpeechAudio(narration);
    if (this.config.renderVideo && this.browserExecutor) {
      await this.captureBrowserRecording({
        action: async () => {
          await this.browserExecutor!.click(selector);
        },
        minDuration: narration ? 1.2 : 1,
        audioPath,
        afterActionDelayMs: 250,
        fallbackText: narration ? `点击 ${selector}\n${narration}` : `点击 ${selector}`,
      });
      return;
    }

    if (this.browserExecutor) {
      await this.browserExecutor.click(selector);
    }
    await this.createSlide(narration ? `点击 ${selector}\n${narration}` : `点击 ${selector}`, narration ? 1.2 : 1, audioPath);
  }

  async browser(path: string): Promise<void> {
    this.log('browser', path);
    if (this.browserExecutor) {
      const url = this.resolveBrowserTarget(path);
      await this.browserExecutor.navigate(url);
      if (this.config.renderVideo) return;
    }
    await this.createSlide(`浏览：${path}`, 1.2);
  }

  async browserEnd(path: string): Promise<void> {
    this.log('browserEnd', path);
    if (this.config.renderVideo && this.browserExecutor) return;
    await this.createSlide(`浏览结束：${path}`, 1);
  }

  async commit(commitHash: string): Promise<void> {
    this.log('commit', commitHash);
    if (!this.gitWorktree) {
      this.gitWorktree = await GitWorktreeManager.create({ projectDir: this.config.projectDir });
      this.config.projectDir = await this.gitWorktree.checkout(commitHash);
      this.currentCommitHash = commitHash;
      return;
    }

    if (this.codeExecutor && this.currentCommitHash) {
      if (!this.gitDiffApplier) {
        this.gitDiffApplier = await GitDiffApplier.create({ projectDir: this.config.projectDir, executor: this.codeExecutor });
      }
      await this.gitDiffApplier.apply(this.currentCommitHash, commitHash);
      this.currentCommitHash = commitHash;
      return;
    }

    this.config.projectDir = await this.gitWorktree.checkout(commitHash);
    this.currentCommitHash = commitHash;
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
    await this.media.assertSegmentsCompatible(this.videoSegments);
    const listPath = join(this.tempDir!, 'concat.txt');
    const listContent = this.videoSegments.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
    await writeFile(listPath, listContent, 'utf-8');
    await this.media.runFFmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', target]);
  }

  private log(action: string, message: string): void {
    const line = `[${action}] ${message}`;
    this.actions.push(line);
    console.log(line);
  }

  private async generateSpeechAudio(text?: string): Promise<string | undefined> {
    if (!this.config.renderVideo) return undefined;
    if (this.config.tts?.engine === 'none') return undefined;
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

  private async createSlide(text: string, duration?: number, audioPath?: string, options: SlideOptions = {}): Promise<void> {
    if (!this.config.renderVideo) return;
    await this.ensureTempDir();
    const segmentPath = await createSlideSegment({
      config: this.config,
      media: this.media,
      tempDir: this.tempDir!,
      segmentIndex: this.videoSegments.length,
      text,
      duration,
      audioPath,
      slideOptions: options,
    });
    this.videoSegments.push(segmentPath);
  }

  private async createImageSlide(
    imagePath: string,
    text?: string,
    duration?: number,
    audioPath?: string,
    options: SlideOptions = {},
  ): Promise<void> {
    if (!this.config.renderVideo) return;
    await this.ensureTempDir();
    const segmentPath = await createImageSlideSegment({
      config: this.config,
      media: this.media,
      tempDir: this.tempDir!,
      segmentIndex: this.videoSegments.length,
      imagePath,
      text,
      duration,
      audioPath,
      slideOptions: options,
    });
    this.videoSegments.push(segmentPath);
  }

  private async captureBrowserRecording(options: {
    action: () => Promise<void>;
    minDuration: number;
    audioPath?: string;
    afterActionDelayMs?: number;
    fallbackText?: string;
  }): Promise<void> {
    if (!this.config.renderVideo || !this.browserExecutor) return;
    await this.ensureTempDir();

    let desiredDuration = options.minDuration;
    if (options.audioPath) {
      const audioDuration = await this.media.getMediaDuration(options.audioPath);
      if (audioDuration) {
        desiredDuration = Math.max(desiredDuration, audioDuration + 0.2);
      }
    }

    let started = false;
    let capturePath: string | undefined;
    let captureStartedAt = 0;
    let captureStopRequestedAt = 0;

    try {
      await this.browserExecutor.startRecording();
      started = true;
      captureStartedAt = Date.now();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[browser] 开始录制失败，降级为截图：${reason}`);
      const screenshotPath = await this.browserExecutor.screenshot();
      if (!screenshotPath) return;
      await this.createImageSlide(screenshotPath, options.fallbackText, desiredDuration, options.audioPath);
      return;
    }

    let actionError: unknown;
    try {
      await options.action();
      if (options.afterActionDelayMs) {
        await this.delay(options.afterActionDelayMs);
      }

      const elapsedMs = Date.now() - captureStartedAt;
      const desiredMs = Math.ceil(desiredDuration * 1000);
      const remainingMs = Math.max(0, desiredMs - elapsedMs);
      if (remainingMs > 0) {
        await this.delay(remainingMs);
      }
    } catch (error) {
      actionError = error;
    } finally {
      if (started) {
        captureStopRequestedAt = Date.now();
        try {
          capturePath = await this.browserExecutor.stopRecording();
        } catch {
          capturePath = undefined;
        }
      }
    }

    if (actionError) throw actionError;

    if (!capturePath) {
      console.warn('[browser] 停止录制失败，降级为截图');
      const screenshotPath = await this.browserExecutor.screenshot();
      if (!screenshotPath) return;
      await this.createImageSlide(screenshotPath, options.fallbackText, desiredDuration, options.audioPath);
      return;
    }

    try {
      const segmentDuration = Math.max(desiredDuration, (captureStopRequestedAt - captureStartedAt) / 1000);
      const segmentPath = await transcodeCaptureToSegment({
        config: this.config,
        media: this.media,
        tempDir: this.tempDir!,
        segmentIndex: this.videoSegments.length,
        capturePath,
        audioPath: options.audioPath,
        duration: segmentDuration,
      });
      this.videoSegments.push(segmentPath);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[browser] 转码失败，降级为截图：${reason}`);
      const screenshotPath = await this.browserExecutor.screenshot();
      if (!screenshotPath) return;
      await this.createImageSlide(screenshotPath, options.fallbackText, desiredDuration, options.audioPath);
    }
  }

  private async recordCodeSegment(context: RuntimeFileContext, lineNumber: number, narration?: string): Promise<void> {
    if (!this.codeExecutor) return;
    if (!context.lines || context.lines.length === 0) {
      throw new Error(`无法读取源码：${context.displayPath}（file(i) 录屏需要存在的源文件）`);
    }
    if (lineNumber < 1 || lineNumber > context.lines.length) {
      throw new Error(`行号超出范围：${context.displayPath}:${lineNumber}（共 ${context.lines.length} 行）`);
    }

    const audioPath = await this.generateSpeechAudio(narration);
    const minDuration = 1.2;
    let desiredDuration = minDuration;
    if (audioPath) {
      const audioDuration = await this.media.getMediaDuration(audioPath);
      if (audioDuration) {
        desiredDuration = Math.max(desiredDuration, audioDuration + 0.2);
      }
    }

    await this.ensureTempDir();

    const captureStartedAt = Date.now();
    await this.codeExecutor.startRecording();

    const targetLine = lineNumber;
    const startLine = context.typedLineCount + 1;
    for (let i = startLine; i <= targetLine; i++) {
      await this.codeExecutor.writeLine(context.lines[i - 1] ?? '', undefined, { appendNewLine: true });
    }
    context.typedLineCount = Math.max(context.typedLineCount, targetLine);

    await this.codeExecutor.highlightLine(targetLine);

    const elapsedMs = Date.now() - captureStartedAt;
    const desiredMs = Math.ceil(desiredDuration * 1000);
    const remainingMs = Math.max(0, desiredMs - elapsedMs);
    if (remainingMs > 0) {
      await this.delay(remainingMs);
    }

    const capturePath = await this.codeExecutor.stopRecording();
    const segmentDuration = Math.max(desiredDuration, (Date.now() - captureStartedAt) / 1000);
    const segmentPath = await transcodeCaptureToSegment({
      config: this.config,
      media: this.media,
      tempDir: this.tempDir!,
      segmentIndex: this.videoSegments.length,
      capturePath,
      audioPath,
      duration: segmentDuration,
    });
    this.videoSegments.push(segmentPath);
  }

  private async flushRemainingFileLines(context: RuntimeFileContext): Promise<void> {
    if (!this.codeExecutor) return;
    if (!context.lines || context.lines.length === 0) return;
    if (context.typedLineCount >= context.lines.length) return;

    await this.ensureTempDir();
    const captureStartedAt = Date.now();
    await this.codeExecutor.startRecording();
    const startLine = Math.max(1, context.typedLineCount + 1);
    for (let i = startLine; i <= context.lines.length; i++) {
      await this.codeExecutor.writeLine(context.lines[i - 1] ?? '', undefined, { appendNewLine: true });
    }
    context.typedLineCount = context.lines.length;

    const minDuration = 0.8;
    const elapsedMs = Date.now() - captureStartedAt;
    const remainingMs = Math.max(0, Math.ceil(minDuration * 1000) - elapsedMs);
    if (remainingMs > 0) {
      await this.delay(remainingMs);
    }

    const capturePath = await this.codeExecutor.stopRecording();
    const segmentDuration = Math.max(minDuration, (Date.now() - captureStartedAt) / 1000);
    const segmentPath = await transcodeCaptureToSegment({
      config: this.config,
      media: this.media,
      tempDir: this.tempDir!,
      segmentIndex: this.videoSegments.length,
      capturePath,
      duration: segmentDuration,
    });
    this.videoSegments.push(segmentPath);
  }

  private delay(durationMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, durationMs));
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

  private resolveBrowserTarget(target: string): string {
    const trimmed = target.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('file://')) return trimmed;
    const resolved = resolveScriptPath(this.config.projectDir, trimmed);
    return pathToFileURL(resolved).href;
  }

  async addSubtitle(videoPath: string, subtitlePath: string): Promise<string> {
    console.log(`[subtitle] ${subtitlePath} -> ${videoPath}`);
    return `${videoPath}.with-subtitle`;
  }
}
