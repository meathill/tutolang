import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { GitHelper } from './git-helper.ts';

export class GitWorktreeManager {
  private helper: GitHelper;
  private originalProjectDir?: string;
  private relativeProjectDirFromRepoRoot: string;
  private tempDir?: string;
  private currentWorktreeDir?: string;

  private constructor(options: { helper: GitHelper; originalProjectDir?: string; relativeProjectDirFromRepoRoot: string }) {
    this.helper = options.helper;
    this.originalProjectDir = options.originalProjectDir;
    this.relativeProjectDirFromRepoRoot = options.relativeProjectDirFromRepoRoot;
  }

  static async create(options: { projectDir?: string }): Promise<GitWorktreeManager> {
    const projectDirResolved = options.projectDir ? resolve(options.projectDir) : process.cwd();
    const probe = new GitHelper({ repoDir: projectDirResolved });
    const repoRoot = await probe.getRepoRoot();
    const computedRelative = relative(repoRoot, projectDirResolved);
    const relativeProjectDirFromRepoRoot = computedRelative.startsWith('..') ? '' : computedRelative;
    const helper = new GitHelper({ repoDir: repoRoot });
    return new GitWorktreeManager({ helper, originalProjectDir: options.projectDir, relativeProjectDirFromRepoRoot });
  }

  getOriginalProjectDir(): string | undefined {
    return this.originalProjectDir;
  }

  async checkout(commitHash: string): Promise<string> {
    await this.ensureTempDir();

    if (this.currentWorktreeDir) {
      await this.tryRemoveWorktree(this.currentWorktreeDir);
    }

    const worktreeDir = this.createWorktreeDir(commitHash);
    await this.helper.worktreeAddDetached(worktreeDir, commitHash);
    this.currentWorktreeDir = worktreeDir;

    return resolve(worktreeDir, this.relativeProjectDirFromRepoRoot);
  }

  async cleanup(): Promise<void> {
    if (this.currentWorktreeDir) {
      await this.tryRemoveWorktree(this.currentWorktreeDir);
      this.currentWorktreeDir = undefined;
    }

    const tempDir = this.tempDir;
    this.tempDir = undefined;
    if (!tempDir) return;

    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  private async ensureTempDir(): Promise<void> {
    if (this.tempDir) return;
    this.tempDir = await mkdtemp(join(tmpdir(), 'tutolang-git-'));
  }

  private createWorktreeDir(commitHash: string): string {
    const safeRef = sanitizeRef(commitHash);
    return join(this.tempDir!, `worktree-${Date.now()}-${safeRef}`);
  }

  private async tryRemoveWorktree(worktreeDir: string): Promise<void> {
    try {
      await this.helper.worktreeRemove(worktreeDir, { force: true });
      await this.helper.worktreePrune();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[git] 无法移除 worktree：${reason}`);
    }
  }
}

function sanitizeRef(ref: string): string {
  const normalized = ref.trim().replaceAll('/', '-').replaceAll('\\', '-');
  const cleaned = normalized.replaceAll(/[^a-zA-Z0-9._-]+/g, '-');
  const collapsed = cleaned.replaceAll(/-+/g, '-').replaceAll(/^-|-$/g, '');
  return collapsed.length > 0 ? collapsed.slice(0, 48) : 'ref';
}

