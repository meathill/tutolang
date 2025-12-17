import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';

export interface TTSOptions {
  apiKey?: string;
  model?: string;
  voiceName?: string;
  sampleRateHertz?: number;
  tempDir?: string;
  client?: Pick<GoogleGenAI, 'models'>;
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

export class TTS {
  private options: TTSOptions;
  private outputDir?: string;
  private warnedAuthMissing = false;

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

    const args: GenerateContentArgs = {
      model: merged.model ?? DEFAULT_MODEL,
      contents: [{ parts: [{ text }] }],
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

    const response = await client.models.generateContent(args as any);
    const inlineData = response?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
    if (!inlineData?.data) {
      throw new Error('TTS 响应缺少音频数据');
    }

    const pcmBuffer = Buffer.from(inlineData.data as string, 'base64');
    const sampleRate = merged.sampleRateHertz ?? DEFAULT_SAMPLE_RATE;
    const wavBuffer = this.wrapWav(pcmBuffer, sampleRate);

    const targetDir = await this.resolveOutputDir(merged.tempDir);
    const filePath = join(targetDir, `${randomUUID()}.wav`);
    await writeFile(filePath, wavBuffer);

    return filePath;
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

  private async resolveOutputDir(tempDir?: string): Promise<string> {
    if (tempDir) {
      await mkdir(tempDir, { recursive: true });
      return tempDir;
    }
    if (!this.outputDir) {
      this.outputDir = await mkdtemp(join(tmpdir(), 'tutolang-tts-'));
    }
    return this.outputDir;
  }

  private warnOnce(message: string): void {
    if (this.warnedAuthMissing) return;
    this.warnedAuthMissing = true;
    console.warn(`[tts] ${message}`);
  }
}
