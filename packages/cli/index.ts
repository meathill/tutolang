import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import TutolangCore from '@tutolang/core';
import { runMockFromFile } from '@tutolang/core/mock';

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
      default: 'en',
    },
    mock: {
      alias: 'm',
      describe: 'Mock mode: parse and print action plan without real execution',
      type: 'boolean',
      default: false,
    },
  })
  .help()
  .version()
  .parseSync();

async function main() {
  const {
    input,
    output,
    compile,
    config,
    verbose,
    language,
    mock,
  } = argv;

  // TODO: Load config file if provided
  const options = {
    language,
    // ...load from config file
  };

  const tutolang = new TutolangCore(options);

  if (verbose) {
    console.log('Starting Tutolang...');
    console.log('Input:', input);
    console.log('Output:', output);
  }

  try {
    if (mock) {
      const mockOutput = await runMockFromFile(input);
      console.log(mockOutput);
      return;
    }
    if (compile) {
      // Only compile to TypeScript
      // TODO: Implement compile-only mode
      const inputPath = resolve(process.cwd(), input);
      const outputPath = resolve(process.cwd(), output);
      await tutolang.compileFile(inputPath, outputPath);
      console.log('Compilation complete!');
    } else {
      // Compile and execute
      // TODO: Implement full execution mode
      const inputPath = resolve(process.cwd(), input);
      const outputPath = resolve(process.cwd(), output);
      await tutolang.executeFile(inputPath, outputPath);
      console.log('Video generation complete!');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
