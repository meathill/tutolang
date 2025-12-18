import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { VSCodeExecutor } from '../packages/vscode-executor/index.ts';

type DemoOptions = {
  baseUrl: string;
  token?: string;
  delayMs: number;
  record: boolean;
  ffmpegPath?: string;
  ffmpegArgsTemplate?: string[];
};

function parseArgs(argv: string[]): DemoOptions {
  const options: DemoOptions = {
    baseUrl: 'http://127.0.0.1:4001',
    token: process.env.TUTOLANG_VSCODE_TOKEN,
    delayMs: 12,
    record: false,
    ffmpegPath: process.env.TUTOLANG_FFMPEG_PATH,
    ffmpegArgsTemplate: undefined,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--baseUrl' && argv[i + 1]) {
      options.baseUrl = argv[i + 1]!;
      i++;
      continue;
    }
    if (arg === '--token' && argv[i + 1]) {
      options.token = argv[i + 1]!;
      i++;
      continue;
    }
    if (arg === '--delayMs' && argv[i + 1]) {
      options.delayMs = Number(argv[i + 1]!) || options.delayMs;
      i++;
      continue;
    }
    if (arg === '--record') {
      options.record = true;
      continue;
    }
    if (arg === '--ffmpegArgsJson' && argv[i + 1]) {
      options.ffmpegArgsTemplate = JSON.parse(argv[i + 1]!) as string[];
      i++;
      continue;
    }
  }

  const envArgs = process.env.TUTOLANG_RECORD_ARGS_JSON?.trim();
  if (!options.ffmpegArgsTemplate && envArgs) {
    options.ffmpegArgsTemplate = JSON.parse(envArgs) as string[];
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sourcePath = join(process.cwd(), 'sample', 'index.html');
  const content = await readFile(sourcePath, 'utf-8');

  const executor = new VSCodeExecutor({
    baseUrl: options.baseUrl,
    token: options.token,
    typingDelayMs: options.delayMs,
    recording: options.record
      ? {
          ffmpegPath: options.ffmpegPath,
          argsTemplate: options.ffmpegArgsTemplate,
        }
      : undefined,
  });

  await executor.initialize();
  await executor.openFile('sample/index.html', { createIfMissing: true, clear: true, preview: false, viewColumn: 1 });

  if (options.record) {
    await executor.startRecording();
  }

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    await executor.writeLine(line, undefined, { delayMs: options.delayMs, appendNewLine: true });
  }

  await executor.highlightLine(6, { durationMs: 1200 });

  if (options.record) {
    const videoPath = await executor.stopRecording();
    console.log(`[demo] 录屏输出：${videoPath}`);
  }

  await executor.cleanup();
}

await main();
