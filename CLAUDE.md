# Claude Code Manager

## 项目概述
Claude Code 的 GUI 外壳应用。不是重新做 Claude Code，而是给命令行版 Claude Code 套一个像 Kimi 网页版那样的图形界面，让非程序员（设计师、学生）也能简单直观地使用。

## 开发者信息
- **身份**：CAFA中央美术学院大一学生，平面设计师
- **技术背景**：非程序员，不懂代码，希望操作简单直观
- **当前 API 切换工具**：使用 GitHub 上的 cc-switch 管理 Claude Code 的 API Key
- **GitHub**：https://github.com/HeBeisheng/claude-code-gui
- **联系方式**：15350885535@163.com

## 当前进度（2026-06-05）
- [x] 项目初始化（Vite + Electron + React）
- [x] 终端嵌入（node-pty + xterm.js）
- [x] Kimi 风格侧边栏布局
- [x] 历史会话列表（扫描 ~/.claude/projects/）
- [x] 点击继续对话（自动 cd + 启动 claude）
- [x] Skill 一键开关
- [x] 功能地图（PS 快捷键鼠标垫风格）
- [x] 设置编辑器
- [x] GitHub 仓库 + Release 发布
- [ ] 用户反馈后 UI 微调
- [ ] README 文档完善

## 技术栈
- Electron 31 + React 19 + Vite
- node-pty（主进程伪终端）
- @xterm/xterm（前端终端渲染）

## 常用命令
```bash
# 启动开发
npm start

# 打包便携版
npm run pack

# 打包安装版（需管理员权限）
npm run dist
```

## 项目路径
- **源码**：`E:\claude code E\程序员\claude-code-manager`
- **GitHub**：https://github.com/HeBeisheng/claude-code-gui
- **Release**：https://github.com/HeBeisheng/claude-code-gui/releases/tag/v1.0.0

## 开发偏好
- 界面要简洁，不要程序员风格
- 全中文界面
- 像 Kimi 那样左侧边栏 + 右侧主区域
- 把命令行功能做成开关/按钮，不要让我记命令
- 功能地图要像 PS 快捷键鼠标垫一样直观
- 用户不是程序员，代码逻辑要尽量简单，优先保证可用性

## 注意事项
- 用户已用 ccswitch 管理 API Key，不需要在应用里重复做
- Windows 上打包 electron-builder 可能遇到符号链接权限问题，便携版更实用
- 应用需要本地已安装 Claude Code CLI 才能正常使用
