import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import yargs from "yargs";
import pkg from './package.json';
import Tutolang from '@tutolang/core';

const { argv } = yargs.scriptName('tutolang')
  .usage('$0 <input> [options]', 'compile tutolang file to JS, and execute it if needed')
  .demandCommand(1, 'You must provide an input file')
  .options({
    output: {
      alias: 'o',
      describe: 'Output folder',
      type: 'string',
    },
  })
  .help('help')
  .version(pkg.version);

const {
  input,
  output,
  ...options
} = argv;

const tutolang = new Tutolang(options);
const code = await readFile(resolve(process.env.CWD, input), 'utf8');
const compiled = tutolang
