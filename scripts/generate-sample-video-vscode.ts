import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Compiler } from '@tutolang/compiler';
import { Runtime } from '@tutolang/runtime';
import { VSCodeExecutor } from '../packages/vscode-executor/index.ts';

type ScriptOptions = {
  inputPath: string;
  outputVideo: string;
  baseUrl: string;
  token?: string;
  typingDelayMs: number;
  ffmpegPath?: string;
  ffprobePath?: string;
  recordArgsTemplate: string[];
};

function parseJsonArray(input: string, name: string): string[] {
  try {
    const parsed = JSON.parse(input) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
      throw new Error(`${name} 需为 JSON 字符串数组`);
    }
    return parsed;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${name} 解析失败：${reason}`);
  }
}

function parseArgs(argv: string[]): Partial<ScriptOptions> {
  const options: Partial<ScriptOptions> = {
    baseUrl: 'http://127.0.0.1:4001',
    token: process.env.TUTOLANG_VSCODE_TOKEN,
    typingDelayMs: 12,
    ffmpegPath: process.env.TUTOLANG_FFMPEG_PATH,
    ffprobePath: process.env.TUTOLANG_FFPROBE_PATH,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--input' && argv[i + 1]) {
      options.inputPath = argv[i + 1]!;
      i++;
      continue;
    }
    if (arg === '--output' && argv[i + 1]) {
      options.outputVideo = argv[i + 1]!;
      i++;
      continue;
    }
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
      options.typingDelayMs = Number(argv[i + 1]!) || options.typingDelayMs;
      i++;
      continue;
    }
    if (arg === '--ffmpegPath' && argv[i + 1]) {
      options.ffmpegPath = argv[i + 1]!;
      i++;
      continue;
    }
    if (arg === '--ffprobePath' && argv[i + 1]) {
      options.ffprobePath = argv[i + 1]!;
      i++;
      continue;
    }
    if (arg === '--recordArgsJson' && argv[i + 1]) {
      options.recordArgsTemplate = parseJsonArray(argv[i + 1]!, '--recordArgsJson');
      i++;
      continue;
    }
  }

  if (!options.recordArgsTemplate) {
    const envArgs = process.env.TUTOLANG_RECORD_ARGS_JSON?.trim();
    if (envArgs) {
      options.recordArgsTemplate = parseJsonArray(envArgs, 'TUTOLANG_RECORD_ARGS_JSON');
    }
  }

  return options;
}

async function main() {
  const argvOptions = parseArgs(process.argv.slice(2));
  const inputPath = argvOptions.inputPath ?? join(process.cwd(), 'sample', 'hello-world.tutolang');
  const outputVideo = argvOptions.outputVideo ?? join(process.cwd(), 'dist', 'hello-world-vscode.mp4');

  const recordArgsTemplate = argvOptions.recordArgsTemplate;
  if (!recordArgsTemplate || recordArgsTemplate.length === 0) {
    console.error('缺少录屏参数模板：请设置 TUTOLANG_RECORD_ARGS_JSON 或传入 --recordArgsJson。');
    console.error('要求：JSON 字符串数组，且必须包含 {output} 占位符。');
    process.exit(1);
  }

  const options: ScriptOptions = {
    inputPath,
    outputVideo,
    baseUrl: argvOptions.baseUrl ?? 'http://127.0.0.1:4001',
    token: argvOptions.token,
    typingDelayMs: argvOptions.typingDelayMs ?? 12,
    ffmpegPath: argvOptions.ffmpegPath,
    ffprobePath: argvOptions.ffprobePath,
    recordArgsTemplate,
  };

  const projectDir = dirname(options.inputPath);
  const outputDir = dirname(options.outputVideo);
  const compiledPath = join(outputDir, `${basename(options.inputPath, extname(options.inputPath))}.vscode.ts`);
  const runtimeTempDir = join(outputDir, 'tutolang-tmp');
  await mkdir(outputDir, { recursive: true });
  await mkdir(runtimeTempDir, { recursive: true });

  const code = await readFile(options.inputPath, 'utf-8');
  const compiled = await new Compiler().compile(code);
  await writeFile(compiledPath, compiled, 'utf-8');

  const url = pathToFileURL(compiledPath).href;
  const mod = await import(url);
  const runner = (mod as any).run ?? (mod as any).default?.run ?? (mod as any).default;
  if (typeof runner !== 'function') {
    console.error('编译产物未导出可执行的 run()，请检查编译器输出。');
    process.exit(1);
  }

  const executor = new VSCodeExecutor({
    baseUrl: options.baseUrl,
    token: options.token,
    typingDelayMs: options.typingDelayMs,
    recording: {
      ffmpegPath: options.ffmpegPath,
      argsTemplate: options.recordArgsTemplate,
      outputDir: join(outputDir, 'captures'),
    },
  });

  const runtime = new Runtime({
    renderVideo: true,
    projectDir,
    tempDir: runtimeTempDir,
    ffmpeg: {
      path: options.ffmpegPath,
      ffprobePath: options.ffprobePath,
    },
  });
  runtime.setCodeExecutor(executor);

  await executor.initialize();
  try {
    await runner(runtime, { output: options.outputVideo });
  } finally {
    await executor.cleanup();
  }

  console.log('生成完成：', options.outputVideo);
  console.log('编译产物：', compiledPath);
  console.log('录屏原始片段：', join(outputDir, 'captures'));
}

main().catch((error) => {
  console.error('生成失败：', error);
  process.exit(1);
});
