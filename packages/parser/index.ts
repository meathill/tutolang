import type { AST, ASTNode, BrowserNode, CommitNode, FileNode, MarkerNode, SayNode, VideoNode } from '@tutolang/types';
import { NodeType } from '@tutolang/types';

type ParseContext = {
  line: number;
  column: number;
};

const INDENT_RE = /^([ \t]*)/;
const COMMENT_RE = /^\s*#/;
const PATH_RE = /['"]([^'"]+)['"]/;

/**
 * 轻量级行解析器：为了 MVP mock，直接按行处理，不做完整词法分析。
 * 支持的头部：
 *   - say:
 *   - say(browser):
 *   - file(i) 'path':
 *   - file(e) 'path':
 *   - browser 'path':
 *   - commit HASH
 *   - video 'path':
 * 块体：缩进大于 0 的行；文件/浏览器块内的 marker 使用 [xxx] 前缀。
 */
export class Parser {
  private lines: string[];
  private index = 0;
  private blockCommentDepth = 0;

  constructor(code: string) {
    this.lines = code.replace(/\r\n/g, '\n').split('\n');
  }

  parse(): AST {
    const ast: AST = [];
    while (this.index < this.lines.length) {
      const raw = this.lines[this.index];
      const trimmed = raw.trim();
      if (this.handleBlockComment(trimmed)) {
        this.index++;
        continue;
      }
      if (!trimmed || COMMENT_RE.test(trimmed)) {
        this.index++;
        continue;
      }

      const ctx = this.context();

      if (/^say\b/.test(trimmed)) {
        ast.push(this.parseSay(ctx));
        continue;
      }

      if (/^file\b/.test(trimmed)) {
        ast.push(this.parseFile(ctx));
        continue;
      }

      if (/^browser\b/.test(trimmed)) {
        ast.push(this.parseBrowser(ctx));
        continue;
      }

      if (/^commit\b/.test(trimmed)) {
        ast.push(this.parseCommit(ctx));
        continue;
      }

      if (/^video\b/.test(trimmed)) {
        ast.push(this.parseVideo(ctx));
        continue;
      }

      // 未知行，跳过但保留行号信息，方便后续扩展
      this.index++;
    }
    return ast;
  }

  private handleBlockComment(trimmed: string): boolean {
    const opens = (trimmed.match(/#\{+/g) || []).length;
    const closes = (trimmed.match(/}\s*$/g) || []).length;
    this.blockCommentDepth += opens;
    if (this.blockCommentDepth > 0) {
      this.blockCommentDepth -= closes;
      if (this.blockCommentDepth < 0) this.blockCommentDepth = 0;
      return true;
    }
    return false;
  }

  private parseSay(ctx: ParseContext): SayNode {
    const header = this.lines[this.index].trim();
    this.index++;
    const params = this.extractParams(header);
    const { lines: contentLines } = this.collectIndentedBlock();
    return {
      type: NodeType.Say,
      line: ctx.line,
      column: ctx.column,
      params,
      content: contentLines.join(' '),
    };
  }

  private parseFile(ctx: ParseContext): FileNode {
    const header = this.lines[this.index].trim();
    this.index++;
    const modeMatch = header.match(/^file\((?<mode>[ie])[^)]*\)/);
    const mode = (modeMatch?.groups?.mode as 'i' | 'e' | undefined) ?? undefined;
    const path = this.extractPath(header, 'file', ctx);

    const { lines: markerLines, contexts } = this.collectIndentedBlock();
    const markers: MarkerNode[] = markerLines
      .map((line, idx) => this.parseMarker(line, contexts[idx]))
      .filter((m): m is MarkerNode => !!m);

    return {
      type: NodeType.File,
      line: ctx.line,
      column: ctx.column,
      mode,
      path,
      markers,
    };
  }

  private parseBrowser(ctx: ParseContext): BrowserNode {
    const header = this.lines[this.index].trim();
    this.index++;
    const path = this.extractPath(header, 'browser', ctx);
    const { lines: markerLines, contexts } = this.collectIndentedBlock();
    const markers: MarkerNode[] = markerLines
      .map((line, idx) => this.parseMarker(line, contexts[idx]))
      .filter((m): m is MarkerNode => !!m);
    return {
      type: NodeType.Browser,
      line: ctx.line,
      column: ctx.column,
      path,
      markers,
    };
  }

  private parseCommit(ctx: ParseContext): CommitNode {
    const header = this.lines[this.index].trim();
    this.index++;
    const [, rawHash] = header.split(/\s+/, 2);
    const hash = rawHash?.replace(/:$/, '');
    if (!hash) {
      throw this.error('commit 语句缺少 commit hash', ctx);
    }
    return {
      type: NodeType.Commit,
      line: ctx.line,
      column: ctx.column,
      commitHash: hash ?? '',
    };
  }

  private parseVideo(ctx: ParseContext): VideoNode {
    const header = this.lines[this.index].trim();
    this.index++;
    const path = this.extractPath(header, 'video', ctx);
    return {
      type: NodeType.Video,
      line: ctx.line,
      column: ctx.column,
      path,
    };
  }

  private parseMarker(trimmed: string, ctx: ParseContext): MarkerNode | null {
    const markerMatch = trimmed.match(/^\[(.+?)\]\s*(.*)$/);
    if (!markerMatch) return null;
    const [, markerBody, content] = markerMatch;
    const parts = markerBody.trim().split(/\s+/);
    const head = parts.shift()?.toLowerCase() ?? '';
    const tail = content.trim();

    if (head === 'start') {
      return this.marker(ctx, 'start', undefined, undefined, tail);
    }
    if (head === 'end') {
      return this.marker(ctx, 'end', undefined, undefined, tail);
    }
    if (head === 'say') {
      return this.marker(ctx, 'line', undefined, undefined, tail);
    }
    if (/^l\d+/.test(head)) {
      const lineNumber = parseInt(head.slice(1), 10);
      return this.marker(ctx, 'line', lineNumber, undefined, tail);
    }
    if (head === 'edit') {
      const lineNumber = parseInt(parts[0] ?? '', 10);
      if (Number.isNaN(lineNumber)) {
        throw this.error('edit 标记缺少行号', ctx);
      }
      return this.marker(ctx, 'edit', lineNumber, undefined, tail);
    }
    if (head === 'hl' || head === 'highlight') {
      const selector = parts.join(' ').trim();
      return this.marker(ctx, 'highlight', undefined, { selector }, tail);
    }
    if (head === 'click') {
      const selector = parts.join(' ').trim();
      return this.marker(ctx, 'click', undefined, { selector }, tail);
    }
    // 默认作为解说行
    return this.marker(ctx, 'line', undefined, undefined, [head, tail].filter(Boolean).join(' '));
  }

  private marker(
    ctx: ParseContext,
    markerType: MarkerNode['markerType'],
    lineNumber?: number,
    params?: Record<string, unknown>,
    content?: string,
  ): MarkerNode {
    return {
      type: NodeType.Marker,
      line: ctx.line,
      column: ctx.column,
      markerType,
      lineNumber,
      params,
      content,
    };
  }

  private extractParams(header: string): Record<string, string> {
    const match = header.match(/^[a-z]+\s*\((.*?)\)/i);
    if (!match) return {};
    const raw = match[1]?.trim() ?? '';
    if (!raw) return {};
    const params: Record<string, string> = {};
    for (const token of this.splitParams(raw)) {
      if (!token) continue;
      const eqIndex = token.indexOf('=');
      if (eqIndex >= 0) {
        const key = token.slice(0, eqIndex).trim();
        const value = this.stripQuotes(token.slice(eqIndex + 1).trim());
        if (key) params[key] = value;
        continue;
      }
      params[token] = 'true';
    }
    return params;
  }

  private splitParams(raw: string): string[] {
    const tokens: string[] = [];
    let buffer = '';
    let inQuote = false;
    let quoteChar = '';
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (inQuote) {
        if (ch === quoteChar && raw[i - 1] !== '\\') {
          inQuote = false;
        }
        buffer += ch;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inQuote = true;
        quoteChar = ch;
        buffer += ch;
        continue;
      }
      if (ch === ',') {
        tokens.push(buffer.trim());
        buffer = '';
        continue;
      }
      buffer += ch;
    }
    if (buffer.trim()) {
      tokens.push(buffer.trim());
    }
    return tokens;
  }

  private extractPath(header: string, keyword: string, ctx: ParseContext): string {
    const pathMatch = header.match(PATH_RE);
    if (!pathMatch) {
      throw this.error(`${keyword} 语句缺少路径`, ctx);
    }
    return pathMatch[1];
  }

  private stripQuotes(text: string): string {
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
      return text.slice(1, -1);
    }
    return text;
  }

  private error(message: string, ctx: ParseContext): Error {
    return new Error(`[ParseError] ${message} (line ${ctx.line})`);
  }

  private context(index: number = this.index): ParseContext {
    return {
      line: index + 1,
      column: 1,
    };
  }

  private collectIndentedBlock(): { lines: string[]; contexts: ParseContext[] } {
    const lines: string[] = [];
    const contexts: ParseContext[] = [];
    let blockIndent: number | null = null;

    while (this.index < this.lines.length) {
      const raw = this.lines[this.index];
      const trimmed = raw.trim();

      if (this.handleBlockComment(trimmed)) {
        this.index++;
        continue;
      }

      const indentLength = this.getIndentLength(raw);

      if (!trimmed && indentLength === 0) break;
      if (indentLength === 0) break;
      if (blockIndent === null) blockIndent = indentLength;
      if (indentLength < blockIndent) break;

      if (!trimmed || COMMENT_RE.test(trimmed)) {
        this.index++;
        continue;
      }

      lines.push(trimmed);
      contexts.push(this.context(this.index));
      this.index++;
    }

    return { lines, contexts };
  }

  private getIndentLength(line: string): number {
    const match = line.match(INDENT_RE);
    return match ? match[1].length : 0;
  }
}
