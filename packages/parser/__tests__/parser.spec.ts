import { describe, expect, test } from '@jest/globals';
import { Parser } from '../index';
import { NodeType } from '@tutolang/types';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

  test('should parse top-level blocks in order', () => {
    const types = ast.map((n) => n.type);
    expect(types).toEqual([
      NodeType.Say,
      NodeType.File,
      NodeType.Say,
      NodeType.Browser,
      NodeType.File,
      NodeType.Browser,
      NodeType.Say,
    ]);
  });

  test('should parse file markers with line numbers and edits', () => {
    const file = ast.find((n) => n.type === NodeType.File && (n as any).mode === 'i');
    expect(file).toBeDefined();
    const markers = (file as any).markers;
    const markerTypes = markers.map((m: any) => m.markerType);
    expect(markerTypes).toEqual(['start', 'line', 'line', 'line', 'line', 'end']);
    const lineNumbers = markers.filter((m: any) => m.markerType === 'line').map((m: any) => m.lineNumber);
    expect(lineNumbers).toEqual([1, 2, 5, 6]);
  });

  test('should parse browser highlight marker', () => {
    const browser = ast.find((n) => n.type === NodeType.Browser) as any;
    const hl = browser.markers.find((m: any) => m.markerType === 'highlight');
    expect(hl).toBeDefined();
    expect(hl.params?.selector).toBe('h1');
  });

  test('should ignore comments and block comments', () => {
    const p = new Parser(WITH_COMMENTS);
    const res = p.parse();
    expect(res.length).toBe(2);
    expect(res[0].type).toBe(NodeType.Say);
    expect((res[1] as any).markers[0].lineNumber).toBe(1);
  });
});
