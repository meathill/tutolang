import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  AST,
  BrowserNode,
  FileNode,
  MarkerNode,
  NodeType,
  SayNode,
} from '@tutolang/types';
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

export async function runMockFromFile(inputPath: string): Promise<string> {
  const abs = resolve(process.cwd(), inputPath);
  const code = await readFile(abs, 'utf-8');
  const parser = new Parser(code);
  const ast = parser.parse();
  const actions = buildActions(ast);
  return formatActions(actions);
}

export function buildActions(ast: AST): Action[] {
  const actions: Action[] = [];
  for (const node of ast) {
    if (node.type === NodeType.Say) {
      actions.push(buildSay(node));
    } else if (node.type === NodeType.File) {
      actions.push(...buildFile(node));
    } else if (node.type === NodeType.Browser) {
      actions.push(...buildBrowser(node));
    }
    // Commit/Video 等先不 mock，后续可扩展
  }
  return actions;
}

function buildSay(node: SayNode): Action {
  return { type: 'say', text: node.content };
}

function buildFile(node: FileNode): Action[] {
  const actions: Action[] = [{ type: 'openFile', path: node.path, mode: node.mode }];
  for (const marker of node.markers) {
    const handled = mapMarkerToAction(marker, node.path);
    if (handled) {
      actions.push(handled);
    }
  }
  actions.push({ type: 'fileEnd', path: node.path });
  return actions;
}

function buildBrowser(node: BrowserNode): Action[] {
  const actions: Action[] = [{ type: 'openBrowser', path: node.path }];
  for (const marker of node.markers) {
    const handled = mapMarkerToAction(marker, node.path);
    if (handled) {
      actions.push(handled);
    }
  }
  actions.push({ type: 'browserEnd', path: node.path });
  return actions;
}

function mapMarkerToAction(marker: MarkerNode, path: string): Action | null {
  const text = marker.content?.trim() ?? '';
  switch (marker.markerType) {
    case 'start':
    case 'end':
      return { type: 'say', text };
    case 'line':
      if (marker.lineNumber !== undefined) {
        return { type: 'inputLine', path, lineNumber: marker.lineNumber, text };
      }
      return { type: 'say', text };
    case 'edit':
      return { type: 'editLine', path, lineNumber: marker.lineNumber ?? 0, text };
    case 'highlight':
      return { type: 'highlight', selector: marker.params?.selector ?? '' };
    case 'click':
      return { type: 'highlight', selector: marker.params?.selector ?? '' }; // click 暂时映射为高亮
    default:
      return null;
  }
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
