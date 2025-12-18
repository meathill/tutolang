import type { RuntimeConfig } from '@tutolang/types';

export function getStandardWidth(config: RuntimeConfig): number {
  return config.screen?.width ?? 1280;
}

export function getStandardHeight(config: RuntimeConfig): number {
  return config.screen?.height ?? 720;
}

export function getStandardFps(config: RuntimeConfig): number {
  return config.output?.fps ?? 30;
}

export function getStandardSampleRate(config: RuntimeConfig): number {
  return config.tts?.sampleRateHertz ?? 24000;
}

