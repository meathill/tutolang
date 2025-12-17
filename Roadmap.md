Roadmap
=======

时间线基于 MVP → 可用版本 → 体验打磨三个阶段，按优先级排列。

## MVP（当前阶段）
- [ ] Parser：补完词法/语法规则、错误提示
- [ ] Compiler：串联插件钩子、生成可执行 TS
- [ ] Runtime：实现 say/file/browser/video/merge 的最小闭环（可先 mock）
- [ ] CLI：`compileFile/executeFile` 打通输入/输出目录
- [ ] 示例：完善 `sample/` 脚本覆盖常见指令

## 可用版本
- [ ] Plugin system：钩子执行顺序、上下文、错误隔离
- [ ] Executor：
  - [ ] VSCode 执行器可输入/录屏
  - [ ] Browser 执行器（Puppeteer）可录屏、点击/高亮
  - [ ] Terminal 执行器可录屏、执行命令
- [ ] Video merger：基于 ffmpeg 的拼接与字幕叠加
- [ ] 多语言/多分辨率产出策略

## 体验打磨
- [ ] 纵向视频/多画幅布局
- [ ] 预设主题与转场
- [ ] Docker 镜像与一键运行
- [ ] VSCode 语法高亮/补全插件
- [ ] 更多示例与文档（Reference、Quickstart、插件指南）
