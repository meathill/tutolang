import type { RuntimeConfig } from '@tutolang/types';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MediaTools } from './media-tools.ts';
import { getStandardFps, getStandardHeight, getStandardSampleRate, getStandardWidth } from './standards.ts';

export type SlideLayout = 'center' | 'code';

export type SlideOptions = {
  layout?: SlideLayout;
};

export async function createSlideSegment(options: {
  config: RuntimeConfig;
  media: MediaTools;
  tempDir: string;
  segmentIndex: number;
  text: string;
  duration?: number;
  audioPath?: string;
  slideOptions?: SlideOptions;
}): Promise<string> {
  const segmentPath = join(options.tempDir, `${options.segmentIndex.toString().padStart(4, '0')}.mp4`);

  const normalized = options.text.replace(/\r\n/g, '\n');
  const textFile = `${segmentPath}.txt`;
  await writeFile(textFile, normalized, 'utf-8');

  const font = '/System/Library/Fonts/Supplemental/Arial.ttf';
  const layout = options.slideOptions?.layout ?? 'center';
  const escapedTextFile = textFile.replace(/:/g, '\\:');
  const draw =
    layout === 'code'
      ? `drawtext=fontfile=${font}:textfile=${escapedTextFile}:fontcolor=white:fontsize=26:box=1:boxcolor=0x000000cc:boxborderw=18:x=60:y=60:line_spacing=6`
      : `drawtext=fontfile=${font}:textfile=${escapedTextFile}:fontcolor=white:fontsize=32:box=1:boxcolor=0x00000099:boxborderw=20:x=(w-text_w)/2:y=(h-text_h)/2:line_spacing=6`;

  let targetDuration = options.duration ?? 2;
  if (options.audioPath) {
    const audioDuration = await options.media.getMediaDuration(options.audioPath);
    if (audioDuration) {
      targetDuration = Math.max(targetDuration, audioDuration + 0.2);
    } else if (options.duration === undefined) {
      targetDuration = Math.max(targetDuration, estimateDuration(options.text, options.config));
    }
  } else if (options.duration === undefined) {
    targetDuration = estimateDuration(options.text, options.config);
  }

  const sampleRate = getStandardSampleRate(options.config);
  const fps = getStandardFps(options.config);
  const width = getStandardWidth(options.config);
  const height = getStandardHeight(options.config);

  const args: string[] = ['-y', '-f', 'lavfi', '-i', `color=size=${width}x${height}:duration=${targetDuration}:rate=${fps}:color=black`];

  if (options.audioPath) args.push('-i', options.audioPath);
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

  await options.media.runFFmpeg(args);
  return segmentPath;
}

export async function transcodeCaptureToSegment(options: {
  config: RuntimeConfig;
  media: MediaTools;
  tempDir: string;
  segmentIndex: number;
  capturePath: string;
  audioPath?: string;
  duration: number;
}): Promise<string> {
  const segmentPath = join(options.tempDir, `${options.segmentIndex.toString().padStart(4, '0')}.mp4`);

  const sampleRate = getStandardSampleRate(options.config);
  const fps = getStandardFps(options.config);
  const width = getStandardWidth(options.config);
  const height = getStandardHeight(options.config);

  const args: string[] = ['-y', '-i', options.capturePath];
  if (options.audioPath) {
    args.push('-i', options.audioPath);
  } else {
    args.push('-f', 'lavfi', '-i', `anullsrc=channel_layout=mono:sample_rate=${sampleRate}`);
  }

  const vf = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},format=yuv420p`;
  args.push('-vf', vf);

  args.push('-af', `apad=whole_dur=${options.duration}`, '-map', '0:v:0', '-map', '1:a:0');

  args.push(
    '-t',
    `${options.duration}`,
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

  await options.media.runFFmpeg(args);
  return segmentPath;
}

function estimateDuration(text: string, config: RuntimeConfig): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const base = words ? words / 2.6 : 1.8;
  const rate = config.tts?.speakingRate ?? 1;
  const estimate = base / rate;
  return Math.min(Math.max(estimate, 1.8), 15);
}

