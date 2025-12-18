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

  async beforeParse(code: string): Promise<string> {
    let result = code;
    for (const plugin of this.plugins) {
      const hook = plugin.hooks.beforeParse;
      if (!hook) continue;
      result = (await hook(result)) ?? result;
    }
    return result;
  }

  async afterParse(ast: AST): Promise<AST> {
    let result = ast;
    for (const plugin of this.plugins) {
      const hook = plugin.hooks.afterParse;
      if (!hook) continue;
      result = (await hook(result)) ?? result;
    }
    return result;
  }

  async beforeCompile(ast: AST): Promise<AST> {
    let result = ast;
    for (const plugin of this.plugins) {
      const hook = plugin.hooks.beforeCompile;
      if (!hook) continue;
      result = (await hook(result)) ?? result;
    }
    return result;
  }

  async afterCompile(code: string): Promise<string> {
    let result = code;
    for (const plugin of this.plugins) {
      const hook = plugin.hooks.afterCompile;
      if (!hook) continue;
      result = (await hook(result)) ?? result;
    }
    return result;
  }

  async beforeExecute(): Promise<void> {
    for (const plugin of this.plugins) {
      const hook = plugin.hooks.beforeExecute;
      if (!hook) continue;
      await hook();
    }
  }

  async afterExecute(): Promise<void> {
    for (const plugin of this.plugins) {
      const hook = plugin.hooks.afterExecute;
      if (!hook) continue;
      await hook();
    }
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
