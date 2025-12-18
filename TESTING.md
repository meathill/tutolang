# 测试指南

本仓库使用 **Node.js 原生测试**（零转译）：

```bash
pnpm test
```

等价于（仅供参考）：

```bash
node --experimental-strip-types --experimental-transform-types --test ...
```

## 覆盖范围（当前）

- Parser：基础语法与 marker 解析
- Compiler + Runtime：MVP 闭环（可执行 TS 产物 + 关键动作日志）
- Runtime：TTS 缓存/落盘、slide 生成参数、录屏片段转码与静音音轨注入
- CLI：配置加载（`tutolang.config.*`）与 VSCode 执行器工厂

