export class GitHelper {
  async checkout(commitHash: string): Promise<void> {
    console.log(`[git] checkout ${commitHash}`);
  }

  async getDiff(from: string, to: string): Promise<string> {
    console.log(`[git] diff ${from}..${to}`);
    return '';
  }

  async getCurrentCommit(): Promise<string> {
    console.log('[git] current');
    return '';
  }
}

