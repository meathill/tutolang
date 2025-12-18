import { spawn } from 'node:child_process';
import { open } from 'node:fs/promises';
import type { RuntimeConfig } from '@tutolang/types';

type SegmentSignature = {
  video: {
    codec: string;
    width: number;
    height: number;
    pixelFormat: string;
    fps: string;
  };
  audio: {
    codec: string;
    channels: number;
    sampleRate: string;
  };
};

export class MediaTools {
  private config: RuntimeConfig;

  constructor(config: RuntimeConfig) {
    this.config = config;
  }

  async getMediaDuration(mediaPath: string): Promise<number | undefined> {
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

  async assertSegmentsCompatible(paths: string[]): Promise<void> {
    if (paths.length <= 1) return;
    const [first, ...rest] = paths;
    if (!first) return;

    let expected: SegmentSignature;
    try {
      expected = await this.getSegmentSignature(first);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`无法检查片段编码参数（请确认已安装 ffprobe 或配置 ffmpeg.ffprobePath）：${reason}`);
    }

    for (const path of rest) {
      let actual: SegmentSignature;
      try {
        actual = await this.getSegmentSignature(path);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`无法检查片段编码参数：${path}（${reason}）`);
      }
      if (!isSameSignature(actual, expected)) {
        throw new Error(
          `片段编码参数不一致，无法使用 concat + -c copy 合并。\n` +
            `- 期望：${formatSignature(expected)}\n` +
            `- 实际：${formatSignature(actual)}\n` +
            `- 文件：${path}\n` +
            `提示：请统一录屏模板参数（分辨率/fps/编码），或先把片段转码为统一参数后再合并。`,
        );
      }
    }
  }

  runFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.getFFmpegPath(), ['-loglevel', 'error', ...args], { stdio: 'inherit' });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
    });
  }

  runFFprobe(args: string[]): Promise<string> {
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

  private async getSegmentSignature(path: string): Promise<SegmentSignature> {
    const raw = await this.runFFprobe([
      '-v',
      'error',
      '-show_entries',
      'stream=codec_type,codec_name,width,height,pix_fmt,r_frame_rate,avg_frame_rate,channels,sample_rate',
      '-of',
      'json',
      path,
    ]);

    const parsed = safeJsonParse(raw);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('ffprobe 输出不是有效 JSON');
    }
    const record = parsed as Record<string, unknown>;
    if (!('streams' in record) || !Array.isArray(record.streams)) {
      throw new Error('ffprobe 输出缺少 streams');
    }

    const streams = record.streams.filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === 'object');
    const video = streams.find((s) => s.codec_type === 'video');
    const audio = streams.find((s) => s.codec_type === 'audio');
    if (!video) throw new Error('缺少视频轨');
    if (!audio) throw new Error('缺少音轨');

    const videoCodec = requireString(video.codec_name, '视频轨 codec_name');
    const width = requireNumber(video.width, '视频轨 width');
    const height = requireNumber(video.height, '视频轨 height');
    const pixelFormat = requireString(video.pix_fmt, '视频轨 pix_fmt');
    const fps = String(video.r_frame_rate ?? video.avg_frame_rate ?? '');
    if (!fps) throw new Error('视频轨 fps 信息不完整');

    const audioCodec = requireString(audio.codec_name, '音轨 codec_name');
    const channels = requireNumber(audio.channels, '音轨 channels');
    const sampleRate = requireString(audio.sample_rate, '音轨 sample_rate');

    return {
      video: { codec: videoCodec, width, height, pixelFormat, fps },
      audio: { codec: audioCodec, channels, sampleRate },
    };
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
}

function formatSignature(signature: SegmentSignature): string {
  return (
    `v=${signature.video.codec} ` +
    `${signature.video.width}x${signature.video.height} ` +
    `${signature.video.pixelFormat} fps=${signature.video.fps}; ` +
    `a=${signature.audio.codec} ch=${signature.audio.channels} rate=${signature.audio.sampleRate}`
  );
}

function isSameSignature(a: SegmentSignature, b: SegmentSignature): boolean {
  return (
    a.video.codec === b.video.codec &&
    a.video.width === b.video.width &&
    a.video.height === b.video.height &&
    a.video.pixelFormat === b.video.pixelFormat &&
    a.video.fps === b.video.fps &&
    a.audio.codec === b.audio.codec &&
    a.audio.channels === b.audio.channels &&
    a.audio.sampleRate === b.audio.sampleRate
  );
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} 信息不完整`);
  }
  return value;
}

function requireNumber(value: unknown, name: string): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`${name} 信息不完整`);
  }
  return num;
}

