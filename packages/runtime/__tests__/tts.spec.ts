import { strict as assert } from 'node:assert';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { TTS } from '../tts.ts';

test('TTS.generate 应发送请求并落地音频文件', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'tutolang-tts-test-'));
  const cacheDir = await mkdtemp(join(tmpdir(), 'tutolang-cache-test-'));
  let capturedUrl = '';
  let capturedBody:
    | {
        model?: string;
        contents?: { parts?: { text?: string }[] }[];
        config?: { speechConfig?: { voiceConfig?: { prebuiltVoiceConfig?: { voiceName?: string } } } };
      }
    | undefined;

  const fakeClient = {
    models: {
      generateContent: async (args: any) => {
        capturedUrl = args.model;
        capturedBody = args;
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
    client: fakeClient as any,
    voiceName: 'Aoede',
  });

  const audioPath = await tts.generate('你好，世界');
  assert.ok(audioPath, '应返回音频路径');
  const saved = await readFile(audioPath!);
  assert.match(saved.subarray(0, 4).toString('ascii'), /RIFF/);
  assert.ok(saved.includes(Buffer.from('demo-pcm')), '应包含返回的 PCM 数据');
  assert.equal(capturedUrl, 'gemini-2.5-flash-tts');
  assert.match(capturedBody?.contents?.[0]?.parts?.[0]?.text ?? '', /朗读以下内容/);
  assert.match(capturedBody?.contents?.[0]?.parts?.[0]?.text ?? '', /你好，世界/);
  assert.equal(capturedBody?.config?.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName, 'Aoede');
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
    client: fakeClient as any,
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
    } as any,
    voiceName: 'Aoede',
  });

  const second = await tts2.generate('你好，世界');
  assert.equal(second, first, '命中缓存时应返回相同的输出路径');
  assert.equal(callCount, 1);
});
