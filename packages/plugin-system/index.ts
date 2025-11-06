import { Plugin, PluginHooks, AST } from '@tutolang/types';

export class PluginManager {
  private plugins: Plugin[] = [];

  constructor(plugins: Plugin[] = []) {
    this.plugins = plugins;
  }

  register(plugin: Plugin): void {
    // TODO: Validate and register plugin
    this.plugins.push(plugin);
  }

  unregister(pluginName: string): void {
    // TODO: Unregister plugin by name
  }

  async callHook(hookName: keyof PluginHooks, ...args: any[]): Promise<any> {
    // TODO: Call all plugins' hooks in sequence
    // Support async hooks
    return args[0];
  }

  async beforeParse(code: string): Promise<string> {
    // TODO: Call all beforeParse hooks
    return code;
  }

  async afterParse(ast: AST): Promise<AST> {
    // TODO: Call all afterParse hooks
    return ast;
  }

  async beforeCompile(ast: AST): Promise<AST> {
    // TODO: Call all beforeCompile hooks
    return ast;
  }

  async afterCompile(code: string): Promise<string> {
    // TODO: Call all afterCompile hooks
    return code;
  }

  async beforeExecute(): Promise<void> {
    // TODO: Call all beforeExecute hooks
  }

  async afterExecute(): Promise<void> {
    // TODO: Call all afterExecute hooks
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
