import { resolve } from 'node:path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { basename } from 'node:path';
import { loadCliConfig } from './config-loader.ts';
import { createBrowserExecutor, createCodeExecutor } from './executor-factory.ts';
type TutolangCoreConstructor = (typeof import('../core/index.ts')).default;
type RunMockFromFile = typeof import('../core/mock.ts').runMockFromFile;

async function loadCore(): Promise<TutolangCoreConstructor> {
  const mod = await importOptional('@tutolang/core', () => import('../core/index.ts'));
  const unwrapped = unwrapModuleDefault(mod);
  if (typeof unwrapped === 'function') return unwrapped as TutolangCoreConstructor;
  throw new Error('无法加载 @tutolang/core');
}

async function loadMock(): Promise<RunMockFromFile> {
  const mod = await importOptional('@tutolang/core/mock', () => import('../core/mock.ts'));
  if (!isRecord(mod) || typeof mod.runMockFromFile !== 'function') {
    throw new Error('无法加载 mock：缺少 runMockFromFile 导出');
  }
  return mod.runMockFromFile as RunMockFromFile;
}

const argv = yargs(hideBin(process.argv))
  .scriptName('tutolang')
  .usage('$0 [options]', 'Compile and execute tutolang files to generate tutorial videos')
  .options({
    input: {
      alias: 'i',
      describe: 'Input .tutolang file or directory',
      type: 'string',
      demandOption: true,
    },
    output: {
      alias: 'o',
      describe: 'Output directory for generated videos',
      type: 'string',
      default: './dist',
    },
    compile: {
      alias: 'c',
      describe: 'Only compile to TypeScript without executing',
      type: 'boolean',
      default: false,
    },
    config: {
      describe: 'Path to config file',
      type: 'string',
    },
    verbose: {
      alias: 'v',
      describe: 'Verbose logging',
      type: 'boolean',
      default: false,
    },
    language: {
      alias: 'l',
      describe: 'Video language',
      type: 'string',
    },
    mock: {
      alias: 'm',
      describe: 'Mock mode: parse and print action plan without real execution',
      type: 'boolean',
      default: false,
    },
    mockFormat: {
      describe: 'Mock output format: text | json | both',
      type: 'string',
      default: 'text',
    },
  })
  .help()
  .version()
  .parseSync();

async function main() {
  const { input, output, compile, config, verbose, language, mock, mockFormat } = argv;

  const Core = await loadCore();
  const loaded = await loadCliConfig(config);
  const effectiveLanguage = language ?? loaded.config.language ?? 'en';
  const options = {
    language: effectiveLanguage,
  };

  const tutolang = new Core(options);
  const runtimeConfig = loaded.config.runtime;

  if (verbose) {
    console.log('Starting Tutolang...');
    console.log('Input:', input);
    console.log('Output:', output);
    if (loaded.path) console.log('Config:', loaded.path);
  }

  try {
    if (mock) {
      const runMock = await loadMock();
      const mockResult = await runMock(input);
      if (mockFormat === 'json') {
        console.log(JSON.stringify(mockResult.actions, null, 2));
      } else if (mockFormat === 'both') {
        console.log(mockResult.text);
        console.log('\n----- JSON -----');
        console.log(JSON.stringify(mockResult.actions, null, 2));
      } else {
        console.log(mockResult.text);
      }
      return;
    }
    if (compile) {
      // Only compile to TypeScript
      const inputPath = resolve(process.cwd(), input);
      const outputPath = resolve(process.cwd(), output);
      await tutolang.compileFile(inputPath, outputPath);
      console.log('Compilation complete!');
    } else {
      // Compile and execute
      const inputPath = resolve(process.cwd(), input);
      const outputPath = resolve(process.cwd(), output);
      const outputVideo = resolve(outputPath, `${basename(input, '.tutolang')}.mp4`);
      const codeExecutor = await createCodeExecutor(loaded.config.executors?.code, { outputDir: outputPath });
      const browserExecutor = await createBrowserExecutor(loaded.config.executors?.browser, { outputDir: outputPath });
      await tutolang.executeFile(inputPath, outputPath, outputVideo, { runtimeConfig, codeExecutor, browserExecutor });
      console.log('Video generation complete! 输出文件：', outputVideo);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

async function importOptional<T>(path: string, fallback: () => Promise<T>): Promise<T> {
  try {
    return (await import(path)) as T;
  } catch {
    return await fallback();
  }
}

function unwrapModuleDefault(mod: unknown): unknown {
  if (!mod || typeof mod !== 'object') return mod;
  const record = mod as Record<string, unknown>;
  if ('default' in record) return record.default;
  return mod;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}
