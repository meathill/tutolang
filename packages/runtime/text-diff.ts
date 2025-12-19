export type DiffOp<T> = {
  type: 'equal' | 'insert' | 'delete';
  items: T[];
};

export function diffSequence<T>(before: readonly T[], after: readonly T[]): DiffOp<T>[] {
  if (before.length === 0 && after.length === 0) return [];
  if (before.length === 0) return [{ type: 'insert', items: [...after] }];
  if (after.length === 0) return [{ type: 'delete', items: [...before] }];

  const n = before.length;
  const m = after.length;
  const max = n + m;
  const offset = max;

  let v = new Int32Array(2 * max + 1).fill(-1);
  v[offset + 1] = 0;

  const trace: Int32Array[] = [];

  for (let d = 0; d <= max; d++) {
    const vNext = new Int32Array(2 * max + 1).fill(-1);

    for (let k = -d; k <= d; k += 2) {
      const kIndex = offset + k;
      const downIndex = kIndex + 1;
      const rightIndex = kIndex - 1;

      let x: number;
      if (k === -d || (k !== d && v[rightIndex] < v[downIndex])) {
        x = v[downIndex];
      } else {
        x = v[rightIndex] + 1;
      }

      let y = x - k;
      while (x < n && y < m && Object.is(before[x], after[y])) {
        x += 1;
        y += 1;
      }

      vNext[kIndex] = x;

      if (x >= n && y >= m) {
        trace.push(vNext);
        return buildDiffOps(trace, before, after, offset);
      }
    }

    trace.push(vNext);
    v = vNext;
  }

  throw new Error('diffSequence: unreachable');
}

export type TextDiffOp = {
  type: 'equal' | 'insert' | 'delete';
  text: string;
  count: number;
};

export function diffChars(before: string, after: string): TextDiffOp[] {
  const beforeChars = Array.from(before);
  const afterChars = Array.from(after);
  const ops = diffSequence(beforeChars, afterChars);
  return ops
    .map((op) => ({ type: op.type, text: op.items.join(''), count: op.items.length }))
    .filter((op) => op.count > 0);
}

type AtomicStep<T> = {
  type: 'equal' | 'insert' | 'delete';
  item: T;
};

function buildDiffOps<T>(trace: Int32Array[], before: readonly T[], after: readonly T[], offset: number): DiffOp<T>[] {
  let x = before.length;
  let y = after.length;
  const stepsReversed: Array<AtomicStep<T>> = [];

  for (let d = trace.length - 1; d > 0; d--) {
    const vPrev = trace[d - 1]!;
    const k = x - y;

    let prevK: number;
    if (k === -d || (k !== d && vPrev[offset + k - 1] < vPrev[offset + k + 1])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }

    const prevX = vPrev[offset + prevK]!;
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      stepsReversed.push({ type: 'equal', item: before[x - 1]! });
      x -= 1;
      y -= 1;
    }

    if (x === prevX) {
      stepsReversed.push({ type: 'insert', item: after[prevY]! });
      y -= 1;
    } else {
      stepsReversed.push({ type: 'delete', item: before[prevX]! });
      x -= 1;
    }
  }

  while (x > 0 && y > 0) {
    stepsReversed.push({ type: 'equal', item: before[x - 1]! });
    x -= 1;
    y -= 1;
  }
  while (x > 0) {
    stepsReversed.push({ type: 'delete', item: before[x - 1]! });
    x -= 1;
  }
  while (y > 0) {
    stepsReversed.push({ type: 'insert', item: after[y - 1]! });
    y -= 1;
  }

  const steps = stepsReversed.reverse();
  const merged: DiffOp<T>[] = [];

  for (const step of steps) {
    const last = merged.at(-1);
    if (last && last.type === step.type) {
      last.items.push(step.item);
      continue;
    }
    merged.push({ type: step.type, items: [step.item] });
  }

  return merged.filter((op) => op.items.length > 0);
}

