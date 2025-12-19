import { spawn } from 'node:child_process';

export type GitHelperOptions = {
  repoDir: string;
};

export class GitHelper {
  private repoDir: string;

  constructor(options: GitHelperOptions) {
    this.repoDir = options.repoDir;
  }

  async assertInsideWorkTree(): Promise<void> {
    const output = await this.runGit(['rev-parse', '--is-inside-work-tree']);
    if (output.trim() !== 'true') {
      throw new Error(`当前目录不是 Git 仓库：${this.repoDir}`);
    }
  }

  async getRepoRoot(): Promise<string> {
    await this.assertInsideWorkTree();
    const output = await this.runGit(['rev-parse', '--show-toplevel']);
    const root = output.trim();
    if (!root) {
      throw new Error('无法解析 Git 仓库根目录');
    }
    return root;
  }

  async checkout(commitHash: string): Promise<void> {
    await this.assertInsideWorkTree();
    await this.runGit(['checkout', '--detach', commitHash]);
  }

  async getDiff(from: string, to: string): Promise<string> {
    await this.assertInsideWorkTree();
    return await this.runGit(['diff', '--no-color', '--no-ext-diff', `${from}..${to}`]);
  }

  async getNameStatusDiff(from: string, to: string): Promise<string> {
    await this.assertInsideWorkTree();
    return await this.runGit(['diff', '--name-status', '--no-color', '--no-ext-diff', `${from}..${to}`]);
  }

  async getFileContent(commitHash: string, filePath: string): Promise<string | undefined> {
    await this.assertInsideWorkTree();
    try {
      return await this.runGit(['show', `${commitHash}:${filePath}`]);
    } catch {
      return undefined;
    }
  }

  async getCurrentCommit(): Promise<string> {
    await this.assertInsideWorkTree();
    const output = await this.runGit(['rev-parse', 'HEAD']);
    const hash = output.trim();
    if (!hash) {
      throw new Error('无法获取当前 commit');
    }
    return hash;
  }

  async getCurrentBranch(): Promise<string | undefined> {
    await this.assertInsideWorkTree();
    const output = await this.runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
    const branch = output.trim();
    if (!branch || branch === 'HEAD') return undefined;
    return branch;
  }

  async hasUncommittedChanges(): Promise<boolean> {
    await this.assertInsideWorkTree();
    const output = await this.runGit(['status', '--porcelain']);
    return output.trim().length > 0;
  }

  async worktreeAddDetached(worktreeDir: string, ref: string): Promise<void> {
    await this.assertInsideWorkTree();
    await this.runGit(['worktree', 'add', '--detach', worktreeDir, ref]);
  }

  async worktreeRemove(worktreeDir: string, options: { force?: boolean } = {}): Promise<void> {
    await this.assertInsideWorkTree();
    const args = ['worktree', 'remove'];
    if (options.force) args.push('--force');
    args.push(worktreeDir);
    await this.runGit(args);
  }

  async worktreePrune(): Promise<void> {
    await this.assertInsideWorkTree();
    await this.runGit(['worktree', 'prune']);
  }

  private runGit(args: string[]): Promise<string> {
    return new Promise((resolvePromise, rejectPromise) => {
      const command = 'git';
      const fullArgs = ['-C', this.repoDir, '--no-pager', '-c', 'color.ui=false', ...args];
      const proc = spawn(command, fullArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      proc.on('error', (error) => {
        rejectPromise(new Error(`无法执行 git：${error instanceof Error ? error.message : String(error)}`));
      });
      proc.on('close', (code) => {
        if (code === 0) {
          resolvePromise(stdout);
          return;
        }
        const reason = stderr.trim() || stdout.trim();
        rejectPromise(new Error(`git ${args.join(' ')} 执行失败（code=${code ?? 'null'}）：${reason}`));
      });
    });
  }
}
