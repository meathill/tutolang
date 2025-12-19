import type { CodeExecutor } from '@tutolang/types';
import { applyLineDiff } from './code-editor.ts';
import { diffSequence } from './text-diff.ts';

export type ApplyFileDiffOptions = {
  delayMs?: number;
};

export async function applyFileDiff(
  executor: CodeExecutor,
  options: { before: string; after: string } & ApplyFileDiffOptions,
): Promise<void> {
  if (options.before === options.after) return;

  const beforeLines = splitLines(options.before);
  const afterLines = splitLines(options.after);

  const ops = diffSequence(beforeLines, afterLines);
  let lineNumber = 1;
  let currentLines = [...beforeLines];

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]!;

    if (op.type === 'equal') {
      lineNumber += op.items.length;
      continue;
    }

    if (op.type === 'delete') {
      const next = ops[i + 1];
      if (next && next.type === 'insert') {
        const deleted = op.items;
        const inserted = next.items;
        const paired = Math.min(deleted.length, inserted.length);

        for (let j = 0; j < paired; j++) {
          await applyLineDiff(executor, {
            lineNumber: lineNumber + j,
            before: deleted[j] ?? '',
            after: inserted[j] ?? '',
            delayMs: options.delayMs,
          });
        }

        if (deleted.length > paired) {
          await executor.moveCursor(lineNumber + paired, 1);
          await executor.deleteLine(deleted.length - paired, { delayMs: options.delayMs });
        }

        if (inserted.length > paired) {
          await insertLines(executor, lineNumber + paired, inserted.slice(paired), currentLines, { delayMs: options.delayMs });
        }

        currentLines.splice(lineNumber - 1, deleted.length, ...inserted);
        lineNumber += inserted.length;
        i += 1;
        continue;
      }

      await executor.moveCursor(lineNumber, 1);
      await executor.deleteLine(op.items.length, { delayMs: options.delayMs });
      currentLines.splice(lineNumber - 1, op.items.length);
      continue;
    }

    if (op.type === 'insert') {
      await insertLines(executor, lineNumber, op.items, currentLines, { delayMs: options.delayMs });
      currentLines.splice(lineNumber - 1, 0, ...op.items);
      lineNumber += op.items.length;
    }
  }
}

type InsertLinesOptions = {
  delayMs?: number;
};

async function insertLines(
  executor: CodeExecutor,
  lineNumber: number,
  lines: string[],
  currentLines: string[],
  options: InsertLinesOptions,
): Promise<void> {
  if (lines.length === 0) return;

  const isInsertBeyondEnd = lineNumber > currentLines.length;
  if (isInsertBeyondEnd && currentLines.length > 0) {
    const lastLineIndex = currentLines.length;
    const lastLineText = currentLines[lastLineIndex - 1] ?? '';
    await executor.moveCursor(lastLineIndex, lastLineText.length + 1);
    await executor.writeChar('\n', { delayMs: options.delayMs });
  } else {
    await executor.moveCursor(lineNumber, 1);
  }

  for (let i = 0; i < lines.length; i++) {
    const text = lines[i] ?? '';
    const isLast = i === lines.length - 1;
    await executor.writeChar(isLast ? `${text}\n` : `${text}\n`, { delayMs: options.delayMs });
  }
}

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split('\n');
}

