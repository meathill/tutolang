import type { CodeExecutor } from '@tutolang/types';
import { diffChars } from './text-diff.ts';

export type ApplyLineDiffOptions = {
  delayMs?: number;
};

export async function applyLineDiff(
  executor: CodeExecutor,
  options: { lineNumber: number; before: string; after: string } & ApplyLineDiffOptions,
): Promise<void> {
  if (options.before === options.after) return;

  const ops = diffChars(options.before, options.after);
  await executor.moveCursor(options.lineNumber, 1);
  let column = 1;

  for (const op of ops) {
    if (op.type === 'equal') {
      column += op.count;
      await executor.moveCursor(options.lineNumber, column);
      continue;
    }

    if (op.type === 'delete') {
      if (op.count > 0) {
        await executor.deleteRight(op.count, { delayMs: options.delayMs });
      }
      continue;
    }

    if (op.type === 'insert') {
      if (op.text) {
        await executor.writeChar(op.text, { delayMs: options.delayMs });
        column += op.count;
      }
      continue;
    }
  }
}

