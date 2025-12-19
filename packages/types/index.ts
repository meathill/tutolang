export type TutolangOptions = {
  language: string;
};

// AST Node Types
export enum NodeType {
  Say = 'say',
  File = 'file',
  Browser = 'browser',
  Commit = 'commit',
  Video = 'video',
  Marker = 'marker',
}

export interface ASTNode {
  type: NodeType;
  line: number;
  column: number;
}

export interface SayNode extends ASTNode {
  type: NodeType.Say;
  params?: Record<string, string>;
  content: string;
}

export interface FileNode extends ASTNode {
  type: NodeType.File;
  mode?: 'i' | 'e'; // input | edit
  path: string;
  markers: MarkerNode[];
}

export interface BrowserNode extends ASTNode {
  type: NodeType.Browser;
  path: string;
  markers: MarkerNode[];
}

export interface MarkerNode extends ASTNode {
  type: NodeType.Marker;
  markerType: 'start' | 'end' | 'line' | 'edit' | 'click' | 'highlight';
  lineNumber?: number;
  params?: Record<string, unknown>;
  content?: string;
}

export interface CommitNode extends ASTNode {
  type: NodeType.Commit;
  commitHash: string;
}

export interface VideoNode extends ASTNode {
  type: NodeType.Video;
  path: string;
}

export type AST = ASTNode[];

// Plugin System
export interface PluginHooks {
  beforeParse?: (code: string) => string | Promise<string>;
  afterParse?: (ast: AST) => AST | Promise<AST>;
  beforeCompile?: (ast: AST) => AST | Promise<AST>;
  afterCompile?: (code: string) => string | Promise<string>;
  beforeExecute?: () => void | Promise<void>;
  afterExecute?: () => void | Promise<void>;
}

export interface Plugin {
  name: string;
  version?: string;
  hooks: PluginHooks;
}

// Executor Interface
export interface Executor {
  name: string;
  initialize(): Promise<void>;
  cleanup(): Promise<void>;
}

export interface CodeExecutor extends Executor {
  openFile(
    path: string,
    options?: { createIfMissing?: boolean; clear?: boolean; preview?: boolean; viewColumn?: number },
  ): Promise<void>;
  writeLine(
    content: string,
    lineNumber?: number,
    options?: { delayMs?: number; appendNewLine?: boolean },
  ): Promise<void>;
  writeChar(char: string, options?: { delayMs?: number }): Promise<void>;
  deleteLeft(count: number, options?: { delayMs?: number }): Promise<void>;
  deleteRight(count: number, options?: { delayMs?: number }): Promise<void>;
  deleteLine(count?: number, options?: { delayMs?: number }): Promise<void>;
  highlightLine(lineNumber: number, options?: { durationMs?: number }): Promise<void>;
  moveCursor(line: number, column: number): Promise<void>;
  saveFile(): Promise<void>;
  startRecording(): Promise<void>;
  stopRecording(): Promise<string>; // returns video path
}

export interface BrowserExecutor extends Executor {
  navigate(url: string): Promise<void>;
  click(selector: string): Promise<void>;
  type(selector: string, text: string): Promise<void>;
  highlight(selector: string): Promise<void>;
  screenshot(): Promise<string>; // returns image path
  startRecording(): Promise<void>;
  stopRecording(): Promise<string>; // returns video path
}

export interface TerminalExecutor extends Executor {
  execute(command: string): Promise<void>;
  type(text: string): Promise<void>;
  startRecording(): Promise<void>;
  stopRecording(): Promise<string>; // returns video path
}

// Runtime Config
export interface RuntimeConfig {
  renderVideo?: boolean;
  tempDir?: string;
  // 用于解析脚本中引用的相对路径（如 `file 'index.html'`），一般由 CLI/Core 注入为脚本所在目录。
  projectDir?: string;
  cacheDir?: string;
  tts?: {
    engine?: 'gemini' | 'none';
    model?: string;
    voiceName?: string;
    languageCode?: string;
    speakingRate?: number;
    pitch?: number;
    sampleRateHertz?: number;
    apiKey?: string;
    accessToken?: string;
    projectId?: string;
    region?: string;
    endpoint?: string;
    cacheDir?: string;
  };
  ffmpeg?: {
    path?: string;
    ffprobePath?: string;
  };
  screen?: {
    width?: number;
    height?: number;
    orientation?: 'portrait' | 'landscape';
  };
  output?: {
    format?: string;
    quality?: number;
    fps?: number;
  };
}
