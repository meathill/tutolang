import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AST, ASTNode, BrowserNode, FileNode, MarkerNode, SayNode } from '@tutolang/types';
import { NodeType } from '@tutolang/types';
import { Parser } from '@tutolang/parser';

export type Action =
  | { type: 'say'; text: string }
  | { type: 'openFile'; path: string; mode?: 'i' | 'e' }
  | { type: 'inputLine'; path: string; lineNumber?: number; text: string }
  | { type: 'editLine'; path: string; lineNumber: number; text: string }
  | { type: 'fileEnd'; path: string }
  | { type: 'openBrowser'; path: string }
  | { type: 'highlight'; selector: string }
  | { type: 'browserEnd'; path: string };

export type MockResult = {
  actions: Action[];
  text: string;
};

export async function runMockFromFile(inputPath: string): Promise<MockResult> {
  const abs = resolve(process.cwd(), inputPath);
  const code = await readFile(abs, 'utf-8');
  const parser = new Parser(code);
  const ast = parser.parse();
  const actions = buildActions(ast);
  return { actions, text: formatActions(actions) };
}

export function buildActions(ast: AST): Action[] {
  const actions: Action[] = [];
  for (const node of ast) {
    if (isSay(node)) {
      actions.push(buildSay(node));
    } else if (isFile(node)) {
      actions.push(...buildFile(node));
    } else if (isBrowser(node)) {
      actions.push(...buildBrowser(node));
    }
    // Commit/Video 等先不 mock，后续可扩展
  }
  return actions;
}

function isSay(node: ASTNode): node is SayNode {
  return node.type === NodeType.Say;
}

function isFile(node: ASTNode): node is FileNode {
  return node.type === NodeType.File;
}

function isBrowser(node: ASTNode): node is BrowserNode {
  return node.type === NodeType.Browser;
}

function buildSay(node: SayNode): Action {
  return { type: 'say', text: node.content };
}

function buildFile(node: FileNode): Action[] {
  const actions: Action[] = [{ type: 'openFile', path: node.path, mode: node.mode }];
  for (const marker of node.markers) {
    const handled = mapMarkerToAction(marker, node.path);
    actions.push(...handled);
  }
  actions.push({ type: 'fileEnd', path: node.path });
  return actions;
}

function buildBrowser(node: BrowserNode): Action[] {
  const actions: Action[] = [{ type: 'openBrowser', path: node.path }];
  for (const marker of node.markers) {
    const handled = mapMarkerToAction(marker, node.path);
    actions.push(...handled);
  }
  actions.push({ type: 'browserEnd', path: node.path });
  return actions;
}

function mapMarkerToAction(marker: MarkerNode, path: string): Action[] {
  const text = marker.content?.trim() ?? '';
  const actions: Action[] = [];
  switch (marker.markerType) {
    case 'start':
    case 'end':
      if (text) actions.push({ type: 'say', text });
      return actions;
    case 'line':
      if (marker.lineNumber !== undefined) {
        actions.push({ type: 'inputLine', path, lineNumber: marker.lineNumber, text });
        return actions;
      }
      if (text) actions.push({ type: 'say', text });
      return actions;
    case 'edit':
      actions.push({ type: 'editLine', path, lineNumber: marker.lineNumber ?? 0, text });
      return actions;
    case 'highlight':
      actions.push({ type: 'highlight', selector: readStringParam(marker.params, 'selector') ?? '' });
      if (text) actions.push({ type: 'say', text });
      return actions;
    case 'click':
      actions.push({ type: 'highlight', selector: readStringParam(marker.params, 'selector') ?? '' });
      if (text) actions.push({ type: 'say', text });
      return actions;
    default:
      if (text) actions.push({ type: 'say', text });
      return actions;
  }
}

function readStringParam(params: Record<string, unknown> | undefined, key: string): string | undefined {
  if (!params) return undefined;
  const value = params[key];
  return typeof value === 'string' ? value : undefined;
}

export function formatActions(actions: Action[]): string {
  return actions
    .map((action, idx) => `${idx + 1}. ${describeAction(action)}`)
    .join('\n')
    .trim();
}

function describeAction(action: Action): string {
  switch (action.type) {
    case 'say':
      return `语音播报：${action.text}`;
    case 'openFile':
      return `打开文件：${action.path}（模式：${action.mode === 'e' ? '编辑 e' : '输入 i'}）`;
    case 'inputLine':
      return `输入行 ${action.lineNumber ?? '?'}：${action.text}`;
    case 'editLine':
      return `编辑行 ${action.lineNumber}：${action.text}`;
    case 'fileEnd':
      return `文件讲解结束：${action.path}`;
    case 'openBrowser':
      return `打开浏览器，加载：${action.path}`;
    case 'highlight':
      return `高亮元素：${action.selector}`;
    case 'browserEnd':
      return `浏览器讲解结束：${action.path}`;
    default:
      return JSON.stringify(action);
  }
}
