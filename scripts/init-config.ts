import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type TemplateName = 'minimal' | 'vscode';

type InitOptions = {
  template: TemplateName;
  targetPath: string;
  force: boolean;
};

function printHelp(): void {
  console.log(
    [
      '用法：pnpm init-config -- [options]',
      '',
      '选项：',
      '  --template <minimal|vscode>  选择模板（默认 minimal）',
      '  --vscode                     等价于 --template vscode',
      '  --home                       生成到 ~/tutolang/config.ts（全局配置）',
      '  --path <path>                指定输出路径（默认 ./tutolang.config.ts）',
      '  -f, --force                  覆盖已存在的文件',
      '  -h, --help                   显示帮助',
      '',
      '说明：配置文件会被 CLI 自动查找加载，详情见 README.md。',
    ].join('\n'),
  );
}

function parseArgs(argv: string[]): InitOptions {
  let template: TemplateName = 'minimal';
  let force = false;
  let useHome = false;
  let customPath: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === '--') continue;
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    if (arg === '--force' || arg === '-f') {
      force = true;
      continue;
    }
    if (arg === '--home') {
      useHome = true;
      continue;
    }
    if (arg === '--vscode') {
      template = 'vscode';
      continue;
    }
    if (arg === '--template') {
      const value = argv[i + 1];
      if (!value) throw new Error('缺少 --template 的值（可选：minimal/vscode）');
      if (value !== 'minimal' && value !== 'vscode') {
        throw new Error(`未知模板：${value}（可选：minimal/vscode）`);
      }
      template = value;
      i += 1;
      continue;
    }
    if (arg === '--path') {
      const value = argv[i + 1];
      if (!value) throw new Error('缺少 --path 的值');
      customPath = value;
      i += 1;
      continue;
    }

    throw new Error(`未知参数：${arg}（可用 --help 查看帮助）`);
  }

  const targetPath = resolveTargetPath({ customPath, useHome });

  return { template, targetPath, force };
}

function resolveTargetPath(options: { customPath?: string; useHome: boolean }): string {
  if (options.customPath) {
    return isAbsolute(options.customPath) ? options.customPath : resolve(process.cwd(), options.customPath);
  }
  if (options.useHome) {
    return join(homedir(), 'tutolang', 'config.ts');
  }
  return resolve(process.cwd(), 'tutolang.config.ts');
}

function resolveTemplatePath(template: TemplateName): string {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(scriptDir, '..');
  const fileName = template === 'vscode' ? 'tutolang.config.vscode.ts' : 'tutolang.config.minimal.ts';
  return join(repoRoot, 'docs', 'templates', fileName);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    return info.isFile();
  } catch (error) {
    const errno = error as NodeJS.ErrnoException;
    if (errno.code === 'ENOENT') return false;
    throw error;
  }
}

async function writeConfigTemplate(options: InitOptions): Promise<void> {
  const templatePath = resolveTemplatePath(options.template);
  const content = await readFile(templatePath, 'utf-8');

  if ((await fileExists(options.targetPath)) && !options.force) {
    throw new Error(`目标文件已存在：${options.targetPath}\n如需覆盖请加 -f/--force。`);
  }

  await mkdir(dirname(options.targetPath), { recursive: true });
  await writeFile(options.targetPath, content, 'utf-8');

  console.log(`已生成配置：${options.targetPath}`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  await writeConfigTemplate(options);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
