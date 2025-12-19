import type { CodeExecutor } from '@tutolang/types';
import { join, relative, resolve } from 'node:path';
import { GitHelper } from './git-helper.ts';
import { applyFileDiff } from './file-editor.ts';

export type GitDiffApplierOptions = {
  projectDir?: string;
  executor: CodeExecutor;
  delayMs?: number;
};

export class GitDiffApplier {
  private git: GitHelper;
  private repoRoot: string;
  private projectPrefix: string;
  private executor: CodeExecutor;
  private delayMs?: number;
  private fileContents = new Map<string, string>();

  private constructor(options: {
    git: GitHelper;
    repoRoot: string;
    projectPrefix: string;
    executor: CodeExecutor;
    delayMs?: number;
  }) {
    this.git = options.git;
    this.repoRoot = options.repoRoot;
    this.projectPrefix = options.projectPrefix;
    this.executor = options.executor;
    this.delayMs = options.delayMs;
  }

  static async create(options: GitDiffApplierOptions): Promise<GitDiffApplier> {
    const projectDirResolved = options.projectDir ? resolve(options.projectDir) : process.cwd();
    const probe = new GitHelper({ repoDir: projectDirResolved });
    const repoRoot = await probe.getRepoRoot();
    const computedRelative = relative(repoRoot, projectDirResolved);
    const projectPrefix = computedRelative.startsWith('..') ? '' : computedRelative;
    const git = new GitHelper({ repoDir: repoRoot });
    return new GitDiffApplier({ git, repoRoot, projectPrefix, executor: options.executor, delayMs: options.delayMs });
  }

  async apply(fromCommit: string, toCommit: string): Promise<void> {
    const raw = await this.git.getNameStatusDiff(fromCommit, toCommit);
    const changes = parseNameStatusDiff(raw);

    for (const change of changes) {
      if (change.type === 'rename') {
        await this.applyDelete(fromCommit, change.fromPath);
        await this.applyAdd(toCommit, change.toPath);
        continue;
      }

      if (!this.shouldHandlePath(change.path)) continue;

      if (change.type === 'delete') {
        await this.applyDelete(fromCommit, change.path);
      } else if (change.type === 'add') {
        await this.applyAdd(toCommit, change.path);
      } else {
        await this.applyModify(fromCommit, toCommit, change.path);
      }
    }
  }

  private shouldHandlePath(path: string): boolean {
    if (!this.projectPrefix) return true;
    if (path === this.projectPrefix) return true;
    return path.startsWith(`${this.projectPrefix}/`);
  }

  private async applyModify(fromCommit: string, toCommit: string, path: string): Promise<void> {
    const before = await this.getCachedOrGitFile(fromCommit, path);
    const after = (await this.git.getFileContent(toCommit, path)) ?? '';
    const absPath = join(this.repoRoot, path);
    await this.executor.openFile(absPath, { createIfMissing: true, clear: false });
    await applyFileDiff(this.executor, { before, after, delayMs: this.delayMs });
    await this.executor.saveFile();
    this.fileContents.set(path, after);
  }

  private async applyAdd(toCommit: string, path: string): Promise<void> {
    const after = (await this.git.getFileContent(toCommit, path)) ?? '';
    const absPath = join(this.repoRoot, path);
    await this.executor.openFile(absPath, { createIfMissing: true, clear: true });
    await this.executor.writeChar(after, { delayMs: this.delayMs });
    await this.executor.saveFile();
    this.fileContents.set(path, after);
  }

  private async applyDelete(fromCommit: string, path: string): Promise<void> {
    const before = await this.getCachedOrGitFile(fromCommit, path);
    const absPath = join(this.repoRoot, path);
    await this.executor.openFile(absPath, { createIfMissing: false });
    const lineCount = splitLines(before).length;
    await this.executor.moveCursor(1, 1);
    await this.executor.deleteLine(Math.max(1, lineCount), { delayMs: this.delayMs });
    await this.executor.saveFile();
    this.fileContents.delete(path);
  }

  private async getCachedOrGitFile(commitHash: string, path: string): Promise<string> {
    const cached = this.fileContents.get(path);
    if (cached !== undefined) return cached;
    return (await this.git.getFileContent(commitHash, path)) ?? '';
  }
}

type GitFileChange =
  | { type: 'modify'; path: string }
  | { type: 'add'; path: string }
  | { type: 'delete'; path: string }
  | { type: 'rename'; fromPath: string; toPath: string };

function parseNameStatusDiff(raw: string): GitFileChange[] {
  const lines = raw
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);

  const changes: GitFileChange[] = [];
  for (const line of lines) {
    const parts = line.split('\t').filter((p) => p.length > 0);
    const statusRaw = parts[0] ?? '';
    const status = statusRaw[0] ?? '';

    if ((status === 'R' || status === 'C') && parts.length >= 3) {
      const fromPath = parts[1] ?? '';
      const toPath = parts[2] ?? '';
      if (fromPath && toPath) {
        changes.push({ type: 'rename', fromPath, toPath });
      }
      continue;
    }

    const path = parts[1] ?? '';
    if (!path) continue;

    if (status === 'A') changes.push({ type: 'add', path });
    else if (status === 'D') changes.push({ type: 'delete', path });
    else changes.push({ type: 'modify', path });
  }

  return changes;
}

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split('\n');
}

