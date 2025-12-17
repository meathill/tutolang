import type { Plugin, PluginHooks, AST } from '@tutolang/types';

export class PluginManager {
  private plugins: Plugin[] = [];

  constructor(plugins: Plugin[] = []) {
    this.plugins = plugins;
  }

  register(plugin: Plugin): void {
    this.plugins.push(plugin);
  }

  unregister(pluginName: string): void {
    this.plugins = this.plugins.filter((p) => p.name !== pluginName);
  }

  async callHook(hookName: keyof PluginHooks, ...args: any[]): Promise<any> {
    let result = args[0];
    for (const plugin of this.plugins) {
      const hook = plugin.hooks[hookName];
      if (!hook) continue;
      // hooks 可以返回修改后的值，也可以返回 undefined
      const maybe = await (hook as any)(result, ...args.slice(1));
      if (maybe !== undefined) {
        result = maybe;
      }
    }
    return result;
  }

  async beforeParse(code: string): Promise<string> {
    return this.callHook('beforeParse', code);
  }

  async afterParse(ast: AST): Promise<AST> {
    return this.callHook('afterParse', ast);
  }

  async beforeCompile(ast: AST): Promise<AST> {
    return this.callHook('beforeCompile', ast);
  }

  async afterCompile(code: string): Promise<string> {
    return this.callHook('afterCompile', code);
  }

  async beforeExecute(): Promise<void> {
    await this.callHook('beforeExecute');
  }

  async afterExecute(): Promise<void> {
    await this.callHook('afterExecute');
  }
}

export abstract class BasePlugin implements Plugin {
  abstract name: string;
  version?: string;
  hooks: PluginHooks = {};

  constructor() {
    // Plugin base class
  }
}
