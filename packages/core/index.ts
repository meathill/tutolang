import type { TutolangOptions } from '@tutolang/types';
import { Compiler } from '@tutolang/compiler';
import { Runtime } from '@tutolang/runtime';

/**
 * Tutolang Core
 * Main entry point that orchestrates compiler and runtime
 */
export default class TutolangCore {
  private compiler: Compiler;
  private runtime: Runtime;
  private options: TutolangOptions;

  constructor(options: TutolangOptions) {
    this.options = options;
    this.compiler = new Compiler();
    this.runtime = new Runtime();
  }

  async compile(code: string): Promise<string> {
    // TODO: Compile .tutolang to executable TypeScript
    const tsCode = await this.compiler.compile(code);
    return tsCode;
  }

  async execute(code: string): Promise<void> {
    // TODO: Compile and execute
    // 1. Compile to TS
    // 2. Run the generated code
    // 3. Generate video
  }

  async compileFile(inputPath: string, outputPath: string): Promise<void> {
    // TODO: Compile file
    // Read .tutolang file, compile, write .ts file
  }

  async executeFile(inputPath: string, outputPath: string): Promise<void> {
    // TODO: Execute from file
    // Compile and run, output video
  }
}
