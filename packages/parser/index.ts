import type { AST, ASTNode, BrowserNode, CommitNode, FileNode, MarkerNode, SayNode, VideoNode } from '@tutolang/types';
import { NodeType } from '@tutolang/types';

type ParseContext = {
  line: number;
  column: number;
};

const INDENT_RE = /^([ \t]*)/;
const COMMENT_RE = /^\s*#/;

/**
 * 轻量级行解析器：为了 MVP mock，直接按行处理，不做完整词法分析。
 * 支持的头部：
 *   - say:
 *   - say(browser):
 *   - file(i) 'path':
 *   - file(e) 'path':
 *   - browser 'path':
 *   - commit HASH:
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
    const params: SayNode['params'] = {};
    if (/say\s*\(\s*browser\s*\)/.test(header) || /say\s*\(\s*browser\s*=\s*.*\)/.test(header)) {
      params.browser = 'true';
    }
    // 读取缩进行
    const contentLines: string[] = [];
    while (this.index < this.lines.length) {
      const line = this.lines[this.index];
      const [indent] = line.match(INDENT_RE) || [''];
      if (!indent.length || COMMENT_RE.test(line.trim())) break;
      contentLines.push(line.trim());
      this.index++;
    }
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
    const modeMatch = header.match(/^file\((?<mode>[ie])\)/);
    const pathMatch = header.match(/'([^']+)'/);
    const mode = (modeMatch?.groups?.mode as 'i' | 'e' | undefined) ?? undefined;
    const path = pathMatch ? pathMatch[1] : '';

    const markers: MarkerNode[] = [];
    while (this.index < this.lines.length) {
      const raw = this.lines[this.index];
      const trimmed = raw.trim();
      const [indent] = raw.match(INDENT_RE) || [''];
      if (!indent.length || (!trimmed && !indent.length)) break;
      if (!trimmed) {
        this.index++;
        continue;
      }
      if (COMMENT_RE.test(trimmed)) {
        this.index++;
        continue;
      }
      const marker = this.parseMarker(trimmed, ctx);
      if (marker) {
        markers.push(marker);
      }
      this.index++;
    }

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
    const pathMatch = header.match(/'([^']+)'/);
    const path = pathMatch ? pathMatch[1] : '';
    const markers: MarkerNode[] = [];
    while (this.index < this.lines.length) {
      const raw = this.lines[this.index];
      const trimmed = raw.trim();
      const [indent] = raw.match(INDENT_RE) || [''];
      if (!indent.length || (!trimmed && !indent.length)) break;
      if (!trimmed) {
        this.index++;
        continue;
      }
      if (COMMENT_RE.test(trimmed)) {
        this.index++;
        continue;
      }
      const marker = this.parseMarker(trimmed, ctx);
      if (marker) {
        markers.push(marker);
      }
      this.index++;
    }
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
    const [, hash] = header.split(/\s+/, 2);
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
    const pathMatch = header.match(/'([^']+)'/);
    const path = pathMatch ? pathMatch[1] : '';
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
      const lineNumber = parseInt(parts[0] ?? '0', 10);
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
    params?: Record<string, any>,
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

  private context(): ParseContext {
    return {
      line: this.index + 1,
      column: 1,
    };
  }
}
