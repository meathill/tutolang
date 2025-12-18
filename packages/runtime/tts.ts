import { copyFile, link, mkdir, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { DiskCache, resolveCacheRootDir } from './ai-cache.ts';

type GenerateContentInput = Parameters<GoogleGenAI['models']['generateContent']>[0];
type GenerateContentResult = Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>;

export interface TTSOptions {
  apiKey?: string;
  model?: string;
  voiceName?: string;
  sampleRateHertz?: number;
  tempDir?: string;
  cacheDir?: string;
  client?: Pick<GoogleGenAI, 'models'>;
  maxRetries?: number;
  minIntervalMs?: number;
}

type GenerateContentArgs = {
  model: string;
  contents: Array<{
    parts: Array<{ text: string }>;
  }>;
  config: {
    responseModalities: ['AUDIO'];
    speechConfig: {
      voiceConfig?: {
        prebuiltVoiceConfig?: {
          voiceName?: string;
        };
      };
    };
  };
};

const DEFAULT_MODEL = 'gemini-2.5-flash-preview-tts';
const DEFAULT_VOICE = 'Puck';
const DEFAULT_SAMPLE_RATE = 24000;
const DEFAULT_RETRY = 3;
const DEFAULT_INTERVAL = 500;

export class TTS {
  private options: TTSOptions;
  private warnedAuthMissing = false;
  private cachePaths = new Map<string, string>();
  private lastRequestAt = 0;

  constructor(options: TTSOptions = {}) {
    this.options = options;
  }

  async generate(text: string, overrides: Partial<TTSOptions> = {}): Promise<string | null> {
    const merged = { ...this.options, ...overrides };
    const apiKey = merged.apiKey ?? process.env.GOOGLE_API_KEY;
    const client = merged.client ?? (apiKey ? new GoogleGenAI(apiKey) : undefined);

    if (!client) {
      this.warnOnce('TTS 未配置 GOOGLE_API_KEY 且未注入 client，跳过语音生成');
      return null;
    }

    const cacheKey = this.buildCacheKey(text, merged);
    const cachedPath = this.cachePaths.get(cacheKey);
    if (cachedPath) {
      const outputPath = await this.ensureOutputFile(cachedPath, merged.tempDir);
      return outputPath;
    }

    const cacheRoot = resolveCacheRootDir(merged.cacheDir);
    const cacheDir = this.resolveTtsCacheDir(cacheRoot);
    const diskCache = new DiskCache({ dir: cacheDir });
    const expectedCachePath = diskCache.resolvePath(cacheKey, 'wav');
    const outputPath = merged.tempDir ? join(merged.tempDir, basename(expectedCachePath)) : expectedCachePath;

    if (await this.fileExists(outputPath)) {
      if (outputPath !== expectedCachePath && !(await this.fileExists(expectedCachePath))) {
        await this.ensureParentDir(cacheDir);
        await this.linkOrCopy(outputPath, expectedCachePath);
      }
      this.cachePaths.set(cacheKey, expectedCachePath);
      return outputPath;
    }

    const cachePath = await diskCache.getOrCreateBuffer(cacheKey, 'wav', async () => {
      await this.waitForRateLimit(merged.minIntervalMs ?? DEFAULT_INTERVAL);

      const prompt = `请生成语音，并仅朗读以下内容，不要添加额外旁白：${text}`;

      const args: GenerateContentArgs = {
        model: merged.model ?? DEFAULT_MODEL,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: merged.voiceName ?? DEFAULT_VOICE,
              },
            },
          },
        },
      };

      const response = await this.withRetry(
        async () =>
          (await client.models.generateContent(args as unknown as GenerateContentInput)) as unknown as GenerateContentResult,
        merged.maxRetries ?? DEFAULT_RETRY,
      );

      const base64 = extractInlineAudioBase64(response);
      if (!base64) {
        throw new Error('TTS 响应缺少音频数据');
      }

      const pcmBuffer = Buffer.from(base64, 'base64');
      const sampleRate = merged.sampleRateHertz ?? DEFAULT_SAMPLE_RATE;
      return this.wrapWav(pcmBuffer, sampleRate);
    });

    this.cachePaths.set(cacheKey, cachePath);
    if (outputPath !== cachePath) {
      await this.ensureParentDir(merged.tempDir);
      await this.linkOrCopy(cachePath, outputPath);
    }
    return outputPath;
  }

  private wrapWav(pcm: Buffer, sampleRate: number): Buffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcm.length;
    const buffer = Buffer.alloc(44 + dataSize);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // PCM chunk size
    buffer.writeUInt16LE(1, 20); // PCM format
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
    pcm.copy(buffer, 44);

    return buffer;
  }

  private warnOnce(message: string): void {
    if (this.warnedAuthMissing) return;
    this.warnedAuthMissing = true;
    console.warn(`[tts] ${message}`);
  }

  private buildCacheKey(text: string, options: TTSOptions): string {
    return JSON.stringify({
      schema: 1,
      text,
      model: options.model ?? DEFAULT_MODEL,
      voice: options.voiceName ?? DEFAULT_VOICE,
      rate: options.sampleRateHertz ?? DEFAULT_SAMPLE_RATE,
    });
  }

  private resolveTtsCacheDir(rootDir: string): string {
    const normalized = rootDir.replace(/[\\/]+$/, '');
    if (basename(normalized) === 'tts') return normalized;
    return join(normalized, 'tts');
  }

  private async ensureOutputFile(cachePath: string, outputDir?: string): Promise<string> {
    if (!outputDir) return cachePath;
    const targetPath = join(outputDir, basename(cachePath));
    if (await this.fileExists(targetPath)) return targetPath;
    await this.ensureParentDir(outputDir);
    await this.linkOrCopy(cachePath, targetPath);
    return targetPath;
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      const info = await stat(path);
      return info.isFile() && info.size > 0;
    } catch (error) {
      const errno = error as NodeJS.ErrnoException;
      if (errno.code === 'ENOENT') return false;
      throw error;
    }
  }

  private async ensureParentDir(dir?: string): Promise<void> {
    if (!dir) return;
    await mkdir(dir, { recursive: true });
  }

  private async linkOrCopy(sourcePath: string, targetPath: string): Promise<void> {
    try {
      await link(sourcePath, targetPath);
    } catch (error) {
      const errno = error as NodeJS.ErrnoException;
      if (errno.code === 'EEXIST') return;
      if (errno.code === 'EXDEV' || errno.code === 'EPERM') {
        await copyFile(sourcePath, targetPath);
        return;
      }
      throw error;
    }
  }

  private async waitForRateLimit(minInterval: number): Promise<void> {
    const now = Date.now();
    const delta = now - this.lastRequestAt;
    if (delta < minInterval) {
      await new Promise((r) => setTimeout(r, minInterval - delta));
    }
    this.lastRequestAt = Date.now();
  }

  private async withRetry<T>(fn: () => Promise<T>, maxRetries: number): Promise<T> {
    let attempt = 0;
    let delay = 300;
    for (;;) {
      try {
        return await fn();
      } catch (error) {
        attempt += 1;
        if (attempt > maxRetries) throw error;
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
      }
    }
  }
}

function extractInlineAudioBase64(response: unknown): string | undefined {
  if (!response || typeof response !== 'object') return undefined;
  const candidates = (response as Record<string, unknown>).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return undefined;
  const first = candidates[0];
  if (!first || typeof first !== 'object') return undefined;
  const content = (first as Record<string, unknown>).content;
  if (!content || typeof content !== 'object') return undefined;
  const parts = (content as Record<string, unknown>).parts;
  if (!Array.isArray(parts) || parts.length === 0) return undefined;
  for (const part of parts) {
    if (!part || typeof part !== 'object') continue;
    const inlineData = (part as Record<string, unknown>).inlineData;
    if (!inlineData || typeof inlineData !== 'object') continue;
    const data = (inlineData as Record<string, unknown>).data;
    if (typeof data === 'string' && data) return data;
  }
  return undefined;
}
