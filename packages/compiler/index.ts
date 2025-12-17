import type { AST, ASTNode, BrowserNode, CommitNode, FileNode, MarkerNode, SayNode, VideoNode, Plugin } from '@tutolang/types';
import { NodeType } from '@tutolang/types';
import { Parser } from '@tutolang/parser';
import { PluginManager } from '@tutolang/plugin-system';

export class Compiler {
  private pluginManager: PluginManager;

  constructor(plugins: Plugin[] = []) {
    this.pluginManager = new PluginManager(plugins);
  }

  async compile(code: string): Promise<string> {
    let processed = await this.pluginManager.beforeParse(code);
    const parser = new Parser(processed);
    let ast = parser.parse();
    ast = await this.pluginManager.afterParse(ast);
    ast = await this.pluginManager.beforeCompile(ast);
    const generator = new CodeGenerator();
    let output = generator.generate(ast);
    output = await this.pluginManager.afterCompile(output);
    return output;
  }
}

export class CodeGenerator {
  generate(ast: AST): string {
    const body = ast.map((node) => this.generateNode(node)).filter(Boolean).join('\n');
    return `${this.generateImports()}

export async function run(runtime = new Runtime()) {
${body}
}

if (import.meta.main) {
  const runtime = new Runtime();
  await run(runtime);
}
`;
  }

  private generateImports(): string {
    return "import { Runtime } from '@tutolang/runtime';";
  }

  private generateNode(node: ASTNode): string {
    switch (node.type) {
      case NodeType.Say:
        return this.generateSayStatement(node as SayNode);
      case NodeType.File:
        return this.generateFileStatement(node as FileNode);
      case NodeType.Browser:
        return this.generateBrowserStatement(node as BrowserNode);
      case NodeType.Commit:
        return this.generateCommitStatement(node as CommitNode);
      case NodeType.Video:
        return this.generateVideoStatement(node as VideoNode);
      default:
        return '';
    }
  }

  private generateSayStatement(node: SayNode): string {
    const params = node.params && Object.keys(node.params).length > 0 ? this.toObjectLiteral(node.params) : 'undefined';
    return `  await runtime.say(${this.quote(node.content)}, ${params});`;
  }

  private generateFileStatement(node: FileNode): string {
    const lines: string[] = [];
    const modePart = node.mode ? `{ mode: ${this.quote(node.mode)} }` : 'undefined';
    lines.push(`  await runtime.file(${this.quote(node.path)}, ${modePart});`);
    for (const marker of node.markers) {
      lines.push(this.generateMarkerStatement(marker, node.path));
    }
    lines.push(`  await runtime.fileEnd(${this.quote(node.path)});`);
    return lines.join('\n');
  }

  private generateBrowserStatement(node: BrowserNode): string {
    const lines: string[] = [];
    lines.push(`  await runtime.browser(${this.quote(node.path)});`);
    for (const marker of node.markers) {
      lines.push(this.generateMarkerStatement(marker, node.path, true));
    }
    lines.push(`  await runtime.browserEnd(${this.quote(node.path)});`);
    return lines.join('\n');
  }

  private generateCommitStatement(node: CommitNode): string {
    return `  await runtime.commit(${this.quote(node.commitHash)});`;
  }

  private generateVideoStatement(node: VideoNode): string {
    return `  await runtime.video(${this.quote(node.path)});`;
  }

  private generateMarkerStatement(marker: MarkerNode, path: string, isBrowser = false): string {
    const content = marker.content ? this.quote(marker.content) : 'undefined';
    switch (marker.markerType) {
      case 'start':
      case 'end':
        return content === 'undefined' ? '  // marker without content' : `  await runtime.say(${content});`;
      case 'line':
        if (marker.lineNumber !== undefined) {
          return `  await runtime.inputLine(${this.quote(path)}, ${marker.lineNumber}, ${content});`;
        }
        return content === 'undefined' ? '  // marker line without content' : `  await runtime.say(${content});`;
      case 'edit':
        return `  await runtime.editLine(${this.quote(path)}, ${marker.lineNumber ?? 0}, ${content});`;
      case 'highlight': {
        const selector = marker.params?.selector ?? '';
        const highlight = `  await runtime.highlight(${this.quote(selector)});`;
        if (content === 'undefined') return highlight;
        return `${highlight}\n  await runtime.say(${content});`;
      }
      case 'click': {
        const selector = marker.params?.selector ?? '';
        const click = `  await runtime.click(${this.quote(selector)});`;
        if (content === 'undefined') return click;
        return `${click}\n  await runtime.say(${content});`;
      }
      default:
        return content === 'undefined' ? '  // marker skipped' : `  await runtime.say(${content});`;
    }
  }

  private quote(text: string): string {
    return JSON.stringify(text ?? '');
  }

  private toObjectLiteral(obj: Record<string, string>): string {
    const entries = Object.entries(obj).map(([k, v]) => `${k}: ${this.quote(v)}`);
    return `{ ${entries.join(', ')} }`;
  }
}
