# TODO List

## Phase 1: 核心架构搭建 ✅

- [x] 创建架构文档
- [x] 定义类型系统
- [x] 创建包骨架

## Phase 2: Parser 实现

- [ ] 实现 Lexer（词法分析器）
  - [ ] 识别关键字（say, file, browser, commit 等）
  - [ ] 识别标识符和字符串
  - [ ] 识别代码块（缩进）
  - [ ] 识别注释
  - [ ] 识别参数列表

- [ ] 实现 Parser（语法分析器）
  - [ ] 解析 say 语句
  - [ ] 解析 file 语句
  - [ ] 解析 browser 语句
  - [ ] 解析 commit 语句
  - [ ] 解析嵌套的代码块
  - [ ] 解析文件内标记（[start], [l1], [edit], [end]）
  - [ ] 解析浏览器标记（[hl], [click]）

- [ ] 定义 AST 节点类型
  - [ ] SayNode
  - [ ] FileNode
  - [ ] BrowserNode
  - [ ] CommitNode
  - [ ] 标记节点

- [ ] 错误处理
  - [ ] 语法错误提示
  - [ ] 错误位置标注

## Phase 3: Compiler + 插件系统

- [ ] 实现 Compiler
  - [ ] AST 遍历
  - [ ] 代码生成
  - [ ] 插件钩子调用

- [ ] 实现 Plugin 系统
  - [ ] PluginManager
  - [ ] Plugin 基类
  - [ ] 生命周期钩子定义
  - [ ] 插件配置加载

- [ ] CodeGenerator
  - [ ] 生成 TypeScript 代码
  - [ ] 生成 import 语句
  - [ ] 生成运行时函数调用

## Phase 4: Runtime 函数实现

### 高优先级
- [ ] say() - 文本转语音
  - [ ] TTS 引擎集成
  - [ ] 背景图片支持
  - [ ] 背景视频支持
  - [ ] 字幕生成

- [ ] file() - 文件展示和输入
  - [ ] 代码高亮
  - [ ] 打字效果模拟
  - [ ] 行号标注
  - [ ] diff 模式

- [ ] browser() - 浏览器操作
  - [ ] Puppeteer 集成
  - [ ] 页面加载
  - [ ] 元素高亮
  - [ ] 点击/输入模拟
  - [ ] 滚动操作

### 中优先级
- [ ] commit() - Git 切换
  - [ ] Git 命令封装
  - [ ] Commit 切换
  - [ ] Diff 获取

- [ ] video() - 视频插入
  - [ ] 视频加载
  - [ ] 视频裁剪

- [ ] merge() - 视频合成
  - [ ] ffmpeg 集成
  - [ ] 片段拼接
  - [ ] 音频混合
  - [ ] 字幕叠加

### 低优先级
- [ ] 转场效果
- [ ] 画中画
- [ ] 代码动画
- [ ] 更多 TTS 引擎

## Phase 5: Executor 实现

### VSCode Executor
- [ ] VSCode Extension 改造
  - [ ] 接收指令接口
  - [ ] writeLine() - 输入一行代码
  - [ ] writeChar() - 输入单个字符
  - [ ] openFile() - 打开文件
  - [ ] highlightLine() - 高亮行
  - [ ] moveCursor() - 移动光标
  - [ ] startRecording() - 开始录制
  - [ ] stopRecording() - 停止录制

### Browser Executor
- [ ] Puppeteer 封装
  - [ ] launch() - 启动浏览器
  - [ ] navigate() - 导航到 URL
  - [ ] click() - 点击元素
  - [ ] type() - 输入文本
  - [ ] highlight() - 高亮元素
  - [ ] screenshot() - 截图
  - [ ] record() - 录制视频

### Terminal Executor
- [ ] 终端录制
  - [ ] execute() - 执行命令
  - [ ] type() - 模拟输入
  - [ ] record() - 录制终端

## Phase 6: CLI 完善

- [ ] 命令行参数解析
  - [ ] -i/--input 输入路径
  - [ ] -o/--output 输出路径
  - [ ] -c/--config 配置文件
  - [ ] -v/--version 版本信息
  - [ ] --verbose 详细日志

- [ ] 配置文件支持
  - [ ] tutolang.config.js
  - [ ] ~/tutolang/config.js

- [ ] 进度显示
  - [ ] 解析进度
  - [ ] 编译进度
  - [ ] 执行进度

## Phase 7: 测试

- [ ] Parser 单元测试
- [ ] Compiler 单元测试
- [ ] Runtime 函数测试
- [ ] 集成测试
- [ ] 示例项目测试

## Phase 8: 文档

- [ ] API 文档
- [ ] 语法参考（完善 Reference.md）
- [ ] 快速开始指南
- [ ] 插件开发指南
- [ ] 示例教程

## Phase 9: 生态

- [ ] VSCode 语法高亮插件
- [ ] 预设插件
  - [ ] GitHub 风格主题
  - [ ] 代码美化插件
  - [ ] 常用转场效果
- [ ] Docker 镜像
- [ ] CI/CD 支持

## Future Ideas

- [ ] 实时预览
- [ ] Web IDE
- [ ] 模板市场
- [ ] 社区分享平台
- [ ] AI 辅助编写脚本
