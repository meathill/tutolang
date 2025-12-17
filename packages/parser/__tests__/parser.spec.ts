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

  it('should parse say params', () => {
    const p = new Parser("say(image='cover.png',browser=/url):\n  hello");
    const res = p.parse();
    const say = res[0] as any;
    assert.strictEqual(say.params.image, 'cover.png');
    assert.strictEqual(say.params.browser, '/url');
  });

  it('should throw when file path missing', () => {
    const p = new Parser("file(i):\n  [start] hi");
    assert.throws(() => p.parse(), /\[ParseError\] file 语句缺少路径/);
  });

  it('should ignore comments and block comments', () => {
    const p = new Parser(WITH_COMMENTS);
    const res = p.parse();
    assert.strictEqual(res.length, 2);
    assert.strictEqual(res[0].type, NodeType.Say);
    assert.strictEqual((res[1] as any).markers[0].lineNumber, 1);
  });

  it('应当保留标记的实际行号', () => {
    const file = ast.find((n) => n.type === NodeType.File) as any;
    assert.ok(file);
    assert.strictEqual(file.markers[0].line, 10);
    assert.strictEqual(file.markers[1].line, 11);
  });

  it('参数解析应处理带逗号的字符串', () => {
    const p = new Parser(`say(title='Hello, world', note="a,b"):\n  hi`);
    const res = p.parse();
    const say = res[0] as any;
    assert.strictEqual(say.params.title, 'Hello, world');
    assert.strictEqual(say.params.note, 'a,b');
  });

  it('编辑标记缺少行号时抛错', () => {
    const p = new Parser(`file(i) 'a':\n  [edit] hi`);
    assert.throws(() => p.parse(), /edit 标记缺少行号/);
  });

  it('commit 缺少 hash 时抛错', () => {
    const p = new Parser('commit:');
    assert.throws(() => p.parse(), /commit 语句缺少 commit hash/);
  });
});
