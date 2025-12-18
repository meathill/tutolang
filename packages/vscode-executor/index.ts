import type { CodeExecutor } from '@tutolang/types';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';

type RpcRequest = {
  id: string;
  method: string;
  params?: unknown;
};

type RpcResponse = {
  id: string;
  result?: unknown;
  error?: {
    message: string;
  };
};

export type VSCodeRecordingOptions = {
  ffmpegPath?: string;
  argsTemplate?: string[];
  outputDir?: string;
};

export type VSCodeExecutorOptions = {
  baseUrl?: string;
  token?: string;
  requestTimeoutMs?: number;
  typingDelayMs?: number;
  recording?: VSCodeRecordingOptions;
};

export class VSCodeExecutor implements CodeExecutor {
  name = 'vscode';
  private options: VSCodeExecutorOptions;
  private recordingProcess?: ChildProcessWithoutNullStreams;
  private recordingOutputPath?: string;

  constructor(options: VSCodeExecutorOptions = {}) {
    this.options = options;
  }

  async initialize(): Promise<void> {
    await this.rpc('ping');
  }

  async cleanup(): Promise<void> {
    if (this.recordingProcess) {
      await this.stopRecording();
    }
  }

  async openFile(
    path: string,
    options?: { createIfMissing?: boolean; clear?: boolean; preview?: boolean; viewColumn?: number },
  ): Promise<void> {
    await this.rpc('openFile', { path, options });
  }

  async writeLine(
    content: string,
    lineNumber?: number,
    options?: { delayMs?: number; appendNewLine?: boolean },
  ): Promise<void> {
    if (lineNumber !== undefined) {
      await this.moveCursor(lineNumber, 1);
    }
    const appendNewLine = options?.appendNewLine ?? true;
    const text = appendNewLine ? `${content}\n` : content;
    await this.rpc('typeText', { text, delayMs: options?.delayMs ?? this.options.typingDelayMs });
  }

  async writeChar(char: string, options?: { delayMs?: number }): Promise<void> {
    await this.rpc('typeText', { text: char, delayMs: options?.delayMs ?? this.options.typingDelayMs });
  }

  async highlightLine(lineNumber: number, options?: { durationMs?: number }): Promise<void> {
    await this.rpc('highlightLine', { line: Math.max(0, lineNumber - 1), durationMs: options?.durationMs });
  }

  async moveCursor(line: number, column: number): Promise<void> {
    await this.rpc('setCursor', { line: Math.max(0, line - 1), column: Math.max(0, column - 1) });
  }

  async startRecording(): Promise<void> {
    if (this.recordingProcess) {
      throw new Error('录屏已在进行中');
    }
    const template = this.options.recording?.argsTemplate;
    if (!template || template.length === 0) {
      throw new Error('未配置录屏参数：请提供 recording.argsTemplate（包含 {output} 占位符）');
    }

    const outputDir = this.options.recording?.outputDir ?? (await mkdtemp(join(tmpdir(), 'tutolang-record-')));
    await mkdir(outputDir, { recursive: true });
    const outputPath = join(outputDir, `vscode-${Date.now()}-${randomUUID()}.mp4`);
    const ffmpegPath = this.options.recording?.ffmpegPath ?? 'ffmpeg';
    const args = template.map((arg) => (arg === '{output}' ? outputPath : arg));

    const proc = spawn(ffmpegPath, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    this.recordingProcess = proc;
    this.recordingOutputPath = outputPath;

    proc.on('error', (error) => {
      console.error(`[vscode-record] ffmpeg 启动失败：${error.message}`);
    });

    // 等待 ffmpeg 真正启动（简单延迟，避免立即 stop 导致空文件）
    await new Promise((r) => setTimeout(r, 300));
  }

  async stopRecording(): Promise<string> {
    const proc = this.recordingProcess;
    const outputPath = this.recordingOutputPath;
    if (!proc || !outputPath) {
      throw new Error('当前没有进行中的录屏');
    }
    this.recordingProcess = undefined;
    this.recordingOutputPath = undefined;

    const stderrChunks: Buffer[] = [];
    proc.stderr.on('data', (chunk) => {
      stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    if (!proc.killed) {
      try {
        proc.stdin.write('q\n');
      } catch {
        // ignore
      }
    }

    const exitCode = await new Promise<number | null>((resolve) => proc.on('close', resolve));
    if (exitCode !== 0) {
      const stderr = Buffer.concat(stderrChunks).toString('utf-8').trim();
      throw new Error(`ffmpeg 录屏失败 (code ${exitCode ?? 'unknown'}): ${stderr}`);
    }
    return outputPath;
  }

  private async rpc(method: string, params?: unknown): Promise<unknown> {
    const baseUrl = this.options.baseUrl ?? 'http://127.0.0.1:4001';
    const url = `${baseUrl.replace(/\/$/, '')}/rpc`;
    const id = randomUUID();
    const payload: RpcRequest = { id, method, params };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.requestTimeoutMs ?? 15_000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.options.token ? { 'x-tutolang-token': this.options.token } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`RPC 请求失败：${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as RpcResponse;
      if (json.error) throw new Error(json.error.message);
      if (json.id !== id) throw new Error('RPC 响应 id 不匹配');
      return json.result;
    } finally {
      clearTimeout(timeout);
    }
  }
}
