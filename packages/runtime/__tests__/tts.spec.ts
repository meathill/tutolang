import { strict as assert } from 'node:assert';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { TTS, type TTSOptions } from '../tts.ts';

test('TTS.generate 应发送请求并落地音频文件', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'tutolang-tts-test-'));
  const cacheDir = await mkdtemp(join(tmpdir(), 'tutolang-cache-test-'));
  let capturedUrl = '';
  let capturedBody: unknown;

  const fakeClient = {
    models: {
      generateContent: async (args: unknown) => {
        capturedBody = args;
        capturedUrl = readStringField(args, 'model') ?? '';
        return {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      data: Buffer.from('demo-pcm').toString('base64'),
                    },
                  },
                ],
              },
            },
          ],
        };
      },
    },
  };

  const tts = new TTS({
    model: 'gemini-2.5-flash-tts',
    tempDir,
    cacheDir,
    client: fakeClient as unknown as TTSOptions['client'],
    voiceName: 'Aoede',
  });

  const audioPath = await tts.generate('你好，世界');
  assert.ok(audioPath, '应返回音频路径');
  const saved = await readFile(audioPath!);
  assert.match(saved.subarray(0, 4).toString('ascii'), /RIFF/);
  assert.ok(saved.includes(Buffer.from('demo-pcm')), '应包含返回的 PCM 数据');
  assert.equal(capturedUrl, 'gemini-2.5-flash-tts');
  assert.match(readPromptText(capturedBody) ?? '', /朗读以下内容/);
  assert.match(readPromptText(capturedBody) ?? '', /你好，世界/);
  assert.equal(readVoiceName(capturedBody), 'Aoede');
});

test('TTS.generate 应命中磁盘缓存，避免重复请求', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'tutolang-tts-output-'));
  const cacheDir = await mkdtemp(join(tmpdir(), 'tutolang-cache-test-'));
  let callCount = 0;

  const fakeClient = {
    models: {
      generateContent: async () => {
        callCount += 1;
        return {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      data: Buffer.from('demo-pcm').toString('base64'),
                    },
                  },
                ],
              },
            },
          ],
        };
      },
    },
  };

  const tts1 = new TTS({
    model: 'gemini-2.5-flash-tts',
    tempDir,
    cacheDir,
    client: fakeClient as unknown as TTSOptions['client'],
    voiceName: 'Aoede',
  });

  const first = await tts1.generate('你好，世界');
  assert.ok(first, '首次应返回音频路径');
  assert.equal(callCount, 1);

  const tts2 = new TTS({
    model: 'gemini-2.5-flash-tts',
    tempDir,
    cacheDir,
    client: {
      models: {
        generateContent: async () => {
          throw new Error('不应触发二次请求');
        },
      },
    } as unknown as TTSOptions['client'],
    voiceName: 'Aoede',
  });

  const second = await tts2.generate('你好，世界');
  assert.equal(second, first, '命中缓存时应返回相同的输出路径');
  assert.equal(callCount, 1);
});

function readStringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const field = record[key];
  return typeof field === 'string' ? field : undefined;
}

function readPromptText(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const record = body as Record<string, unknown>;
  const contents = record.contents;
  if (!Array.isArray(contents) || contents.length === 0) return undefined;
  const first = contents[0];
  if (!first || typeof first !== 'object') return undefined;
  const parts = (first as Record<string, unknown>).parts;
  if (!Array.isArray(parts) || parts.length === 0) return undefined;
  const part = parts[0];
  if (!part || typeof part !== 'object') return undefined;
  const text = (part as Record<string, unknown>).text;
  return typeof text === 'string' ? text : undefined;
}

function readVoiceName(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const record = body as Record<string, unknown>;
  const config = record.config;
  if (!config || typeof config !== 'object') return undefined;
  const speechConfig = (config as Record<string, unknown>).speechConfig;
  if (!speechConfig || typeof speechConfig !== 'object') return undefined;
  const voiceConfig = (speechConfig as Record<string, unknown>).voiceConfig;
  if (!voiceConfig || typeof voiceConfig !== 'object') return undefined;
  const prebuilt = (voiceConfig as Record<string, unknown>).prebuiltVoiceConfig;
  if (!prebuilt || typeof prebuilt !== 'object') return undefined;
  const voiceName = (prebuilt as Record<string, unknown>).voiceName;
  return typeof voiceName === 'string' ? voiceName : undefined;
}
