import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve as resolvePath } from 'node:path';

export type FileContext = {
  displayPath: string;
  resolvedPath?: string;
  mode?: 'i' | 'e';
  lines?: string[];
  revealedLineCount: number;
};

export type FilePreviewOptions = {
  highlightLine?: number;
  narration?: string;
  includeNarration?: boolean;
  screenHeight?: number;
};

export function resolveScriptPath(baseDir: string | undefined, path: string): string {
  if (isAbsolute(path)) return path;
  return resolvePath(baseDir ?? process.cwd(), path);
}

export async function tryReadFileLines(path: string): Promise<string[] | undefined> {
  try {
    const raw = await readFile(path, 'utf-8');
    return raw.replace(/\r\n/g, '\n').split('\n');
  } catch (error) {
    const errno = error as NodeJS.ErrnoException;
    if (errno.code === 'ENOENT' || errno.code === 'ENOTDIR') return undefined;
    console.warn(`[file] 读取失败：${path} (${errno.code ?? 'unknown'})`);
    return undefined;
  }
}

export function renderFilePreview(context: FileContext, options: FilePreviewOptions = {}): string {
  const lines = context.lines ?? [];
  const totalLines = lines.length;
  const revealCount = Math.max(0, Math.min(context.revealedLineCount, totalLines));
  const visibleLines = lines.slice(0, revealCount);

  const maxLines = (options.screenHeight ?? 720) <= 720 ? 18 : 26;

  const highlightLine = options.highlightLine;
  let startIndex = Math.max(0, visibleLines.length - maxLines);
  if (highlightLine !== undefined) {
    const highlightIndex = highlightLine - 1;
    if (highlightIndex < startIndex || highlightIndex >= startIndex + maxLines) {
      startIndex = Math.max(0, highlightIndex - Math.floor(maxLines / 2));
    }
    startIndex = Math.min(startIndex, Math.max(0, visibleLines.length - maxLines));
  }

  const windowLines = visibleLines.slice(startIndex, startIndex + maxLines);
  const numberWidth = String(Math.max(1, totalLines)).length;

  const headerParts: string[] = [context.displayPath];
  if (context.mode) headerParts.push(`(${context.mode})`);
  if (totalLines > 0) headerParts.push(`${revealCount}/${totalLines}`);
  const header = headerParts.join(' ');

  const body =
    windowLines.length > 0
      ? windowLines
          .map((line, index) => {
            const lineNumber = startIndex + index + 1;
            const isHighlight = highlightLine !== undefined && lineNumber === highlightLine;
            const prefix = isHighlight ? '>' : ' ';
            const padded = String(lineNumber).padStart(numberWidth);
            return `${prefix}${padded}| ${line}`;
          })
          .join('\n')
      : context.mode === 'i'
        ? '（等待输入…）'
        : '（空文件）';

  const narration = options.narration?.trim();
  if (options.includeNarration && narration) {
    return `${header}\n${body}\n\n解说：${narration}`;
  }
  return `${header}\n${body}`;
}

