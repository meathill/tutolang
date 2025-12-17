import { strict as assert } from 'node:assert';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { TTS } from '../tts.ts';

test('TTS.generate 应发送请求并落地音频文件', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'tutolang-tts-test-'));
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
    client: fakeClient as any,
    voiceName: 'Aoede',
  });

  const audioPath = await tts.generate('你好，世界');
  assert.ok(audioPath, '应返回音频路径');
  const saved = await readFile(audioPath!);
  assert.match(saved.subarray(0, 4).toString('ascii'), /RIFF/);
  assert.ok(saved.includes(Buffer.from('demo-pcm')), '应包含返回的 PCM 数据');
  assert.equal(capturedUrl, 'gemini-2.5-flash-tts');
  assert.equal(capturedBody?.contents?.[0]?.parts?.[0]?.text, '你好，世界');
  assert.equal(capturedBody?.config?.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName, 'Aoede');
});
