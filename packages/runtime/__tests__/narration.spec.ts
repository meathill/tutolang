import { strict as assert } from 'node:assert';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Runtime } from '../index.ts';

test('Runtime.inputLine 应为逐行解说生成语音并传入 createSlide', async () => {
  const runtime = new Runtime({ renderVideo: true });

  let generatedText: string | undefined;
  const fakeAudioPath = '/tmp/tutolang-fake-line.wav';
  (runtime as unknown as { tts: { generate: (text: string) => Promise<string> } }).tts.generate = async (text) => {
    generatedText = text;
    return fakeAudioPath;
  };

  let slideAudio: string | undefined;
  (runtime as unknown as { createSlide: (text: string, duration?: number, audioPath?: string) => Promise<void> }).createSlide = async (
    _text,
    _duration,
    audioPath,
  ) => {
    slideAudio = audioPath;
  };

  const originalLog = console.log;
  console.log = () => undefined;
  try {
    await runtime.inputLine('index.html', 1, 'First, we declare the doctype.');
  } finally {
    console.log = originalLog;
  }
  assert.equal(generatedText, 'First, we declare the doctype.');
  assert.equal(slideAudio, fakeAudioPath);
});

test('Runtime.editLine 应为逐行解说生成语音并传入 createSlide', async () => {
  const runtime = new Runtime({ renderVideo: true });

  let generatedText: string | undefined;
  const fakeAudioPath = '/tmp/tutolang-fake-edit.wav';
  (runtime as unknown as { tts: { generate: (text: string) => Promise<string> } }).tts.generate = async (text) => {
    generatedText = text;
    return fakeAudioPath;
  };

  let slideAudio: string | undefined;
  (runtime as unknown as { createSlide: (text: string, duration?: number, audioPath?: string) => Promise<void> }).createSlide = async (
    _text,
    _duration,
    audioPath,
  ) => {
    slideAudio = audioPath;
  };

  const originalLog = console.log;
  console.log = () => undefined;
  try {
    await runtime.editLine('index.html', 6, 'We will change the heading text.');
  } finally {
    console.log = originalLog;
  }
  assert.equal(generatedText, 'We will change the heading text.');
  assert.equal(slideAudio, fakeAudioPath);
});

test('Runtime.file/inputLine 在可读取源码时应输出代码预览并高亮行号', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'tutolang-runtime-test-'));
  const sourcePath = join(workDir, 'index.html');
  await writeFile(
    sourcePath,
    ['<!doctype html>', '<html>', '<head>', '</head>', '<body>', '  <h1>Hello World</h1>', '</body>', '</html>'].join('\n'),
    'utf-8',
  );

  const runtime = new Runtime({ renderVideo: true, projectDir: workDir });

  (runtime as unknown as { tts: { generate: (text: string) => Promise<string | null> } }).tts.generate = async () => '/tmp/tutolang-fake.wav';

  const slides: Array<{ text: string; layout?: string }> = [];
  (runtime as unknown as { createSlide: (text: string, duration?: number, audioPath?: string, options?: { layout?: string }) => Promise<void> }).createSlide =
    async (text, _duration, _audioPath, options) => {
      slides.push({ text, layout: options?.layout });
    };

  const originalLog = console.log;
  console.log = () => undefined;
  try {
    await runtime.file('index.html', { mode: 'i' });
    await runtime.inputLine('index.html', 1, 'First, we declare the doctype.');
    await runtime.inputLine('index.html', 5, 'The body tag will contain our content.');
  } finally {
    console.log = originalLog;
  }

  assert.equal(slides[0]?.layout, 'code');
  assert.match(slides[0]?.text ?? '', /index\.html \(i\) 0\/8/);

  assert.equal(slides[1]?.layout, 'code');
  assert.match(slides[1]?.text ?? '', />1\| <!doctype html>/);
  assert.match(slides[1]?.text ?? '', /解说：First, we declare the doctype\./);

  assert.equal(slides[2]?.layout, 'code');
  assert.match(slides[2]?.text ?? '', />5\| <body>/);
  assert.match(slides[2]?.text ?? '', / 2\| <html>/);
});
