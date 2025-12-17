import { createHash, randomUUID } from 'node:crypto';
import { link, mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type DiskCacheOptions = {
  dir: string;
};

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    return info.isFile() && info.size > 0;
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') return false;
    throw error;
  }
}

function normalizeExtension(extension: string): string {
  if (!extension) return '';
  return extension.startsWith('.') ? extension : `.${extension}`;
}

export class DiskCache {
  private dir: string;

  constructor(options: DiskCacheOptions) {
    this.dir = options.dir;
  }

  resolvePath(key: string, extension: string): string {
    const digest = createHash('sha256').update(key).digest('hex');
    return join(this.dir, `${digest}${normalizeExtension(extension)}`);
  }

  async getOrCreateBuffer(key: string, extension: string, create: () => Promise<Buffer>): Promise<string> {
    await mkdir(this.dir, { recursive: true });
    const targetPath = this.resolvePath(key, extension);
    if (await fileExists(targetPath)) return targetPath;

    const tempPath = join(this.dir, `${randomUUID()}.tmp`);
    try {
      const buffer = await create();
      await writeFile(tempPath, buffer);
      try {
        await link(tempPath, targetPath);
      } catch (error) {
        if (isErrnoException(error) && error.code === 'EEXIST') return targetPath;
        throw error;
      }
      return targetPath;
    } finally {
      await unlink(tempPath).catch(() => undefined);
    }
  }
}

export function resolveCacheRootDir(explicit?: string): string {
  const fromEnv = process.env.TUTOLANG_CACHE_DIR?.trim();
  if (explicit?.trim()) return explicit.trim();
  if (fromEnv) return fromEnv;
  return join(process.cwd(), '.tutolang-cache');
}
