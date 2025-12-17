import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NodeType } from '@tutolang/types';
import { Parser } from '../index.ts';

const SAMPLE_PATH = resolve(process.cwd(), 'sample/hello-world.tutolang');
const WITH_COMMENTS = `
# comment line
say:
    hi
#{
  block
}
file(i) 'a.txt':
    [l1] first
`;

describe('Parser (MVP subset)', () => {
  const code = readFileSync(SAMPLE_PATH, 'utf-8');
  const parser = new Parser(code);
  const ast = parser.parse();

  it('should parse top-level blocks in order', () => {
    const types = ast.map((n) => n.type);
    assert.deepStrictEqual(types, [
      NodeType.Say,
      NodeType.File,
      NodeType.Say,
      NodeType.Browser,
      NodeType.File,
      NodeType.Browser,
      NodeType.Say,
    ]);
  });

  it('should parse file markers with line numbers and edits', () => {
    const file = ast.find((n) => n.type === NodeType.File && (n as any).mode === 'i');
    assert.ok(file);
    const markers = (file as any).markers as any[];
    const markerTypes = markers.map((m: any) => m.markerType);
    assert.deepStrictEqual(markerTypes, ['start', 'line', 'line', 'line', 'line', 'end']);
    const lineNumbers = markers.filter((m: any) => m.markerType === 'line').map((m: any) => m.lineNumber);
    assert.deepStrictEqual(lineNumbers, [1, 2, 5, 6]);
  });

  it('should parse browser highlight marker', () => {
    const browser = ast.find((n) => n.type === NodeType.Browser) as any;
    const hl = browser.markers.find((m: any) => m.markerType === 'highlight');
    assert.ok(hl);
    assert.strictEqual(hl.params?.selector, 'h1');
  });

  it('should ignore comments and block comments', () => {
    const p = new Parser(WITH_COMMENTS);
    const res = p.parse();
    assert.strictEqual(res.length, 2);
    assert.strictEqual(res[0].type, NodeType.Say);
    assert.strictEqual((res[1] as any).markers[0].lineNumber, 1);
  });
});
