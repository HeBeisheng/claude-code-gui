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
- [x] **历史项目自定义别名**（新增，2026/6/5）
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

<!-- DYNAMIC_MEMORY_START -->
# 对话记忆

**生成时间**: 2026/6/5

## 用户偏好与性格

- 用户是 CAFA 中央美术学院大一学生，平面设计师，非程序员
- 对视觉和界面有要求，希望操作简单直观
- 全中文界面，像 Kimi 那样左侧边栏 + 右侧主区域
- 把命令行功能做成开关/按钮，不要记命令
- 功能地图要像 PS 快捷键鼠标垫一样直观
- 代码逻辑要尽量简单，优先保证可用性
- 不追求完美，先做出来再迭代
- 喜欢被及时追问和质疑，这样需求更清晰
- 对技术细节不感兴趣，只关心好不好用

## 项目进度

- [x] 方向转型：从配置管理器转为 Claude Code GUI 载体
- [x] 终端嵌入（node-pty + xterm.js）
- [x] Kimi 风格布局（左侧边栏 + 右侧终端）
- [x] 历史会话列表（扫描 ~/.claude/projects/）
- [x] 点击继续对话（自动 cd + 启动 claude）
- [x] 新建对话（选择目录后自动运行 claude）
- [x] 终端会话保留（切换面板不丢失）
- [x] Skill 一键开关
- [x] 功能地图（PS 快捷键鼠标垫风格）
- [x] 设置编辑器
- [x] 暗色主题全面更新
- [x] 记忆系统（退出弹窗、自动生成、加载其他项目记忆）
- [x] GitHub 仓库创建
- [x] GitHub Release 发布（v1.0.0）
- [x] **历史项目自定义别名**（新增，2026/6/5）
- [ ] 用户反馈后 UI 微调
- [ ] README 文档完善

## 重要决策

- 不做 API 切换功能（用户用 cc-switch 管理）
- 不做气泡聊天界面，主区域是终端
- 便携版优先于安装包（Windows 符号链接权限问题）
- 用 `CLAUDE.md` + `.claude/memory.md` 双文件记忆机制
- 退出时强制弹窗保存记忆
- 项目路径从 `E:\claude code E\claude-code-manager` 移到 `E:\claude code E\程序员\claude-code-manager`
- **自定义别名存储在 `~/.claude/project-aliases.json`，键为项目文件夹名，值为自定义显示名**
- **双击项目名称进入编辑，回车保存，ESC 取消**

## 完整对话摘要

### 开场
用户希望继续开发 Claude Code Manager，明确了方向转型：不是配置管理器，而是 Claude Code 的 GUI 载体/外壳。目标是让非程序员（设计师、学生）能简单直观地使用 Claude Code。

### 需求确认
经过追问，确认了核心需求：
- 套壳终端，保留 Claude Code 原生能力
- Kimi 网页版风格布局
- 历史对话列表 + 点击继续
- Skill 快速开关
- 功能地图（像 PS 快捷键鼠标垫）
- 自动启动 claude 命令

### 技术选型
用户已在用 cc-switch 管理 API Key，不需要在应用里重复做。确定了"侧边栏 + 终端主区域"的架构方案。

### 开发实现
- 安装 node-pty 和 @xterm/xterm
- 重构 Electron 主进程添加 PTY 支持
- 新建 TerminalPanel、FeatureMap、MemoryPanel 组件
- 重构 App.jsx 为 Kimi 风格布局
- 重做 SkillsPanel 为开关模式
- 更新 CSS 暗色主题
- 修复启动加载 dist 文件的问题

### GitHub 发布
- 创建 GitHub 仓库：https://github.com/HeBeisheng/claude-code-gui
- 发布 Release v1.0.0
- 添加项目描述："CAFA中央美术学院大一出品，如有建议15350885535@163.com。"

### 打包问题
- electron-builder 在沙箱中因符号链接权限问题失败
- 用户电脑上同样遇到 winCodeSign 符号链接问题
- 改为便携版（target: dir, signAndEditExecutable: false）
- 成功生成 `release\win-unpacked\Claude Code Manager.exe`

### 记忆系统
- 实现项目级记忆系统
- 退出时强制弹窗（保存/不保存/取消）
- 自动生成对话摘要（偏好、进度、决策、完整摘要）
- 手动编辑记忆
- 加载其他项目记忆
- 保存到 `.claude/memory.md` 并同步到 `CLAUDE.md`

### 文件移动
- 对话记录保存到 `E:\claude code E\程序员\对话记录-20260605.jsonl`
- 项目文件夹移到 `E:\claude code E\程序员\claude-code-manager`
- 创建了 `CLAUDE.md` 作为项目上下文

### 新增功能：历史项目自定义别名（2026/6/5）
用户提出新需求：左侧历史项目列表里，每个项目不只是显示文件夹名字，还要支持自定义别名。显示方式改为两行：第一行是可编辑的自定义名字（双击进入编辑），第二行是文件夹路径（灰色小字）。

确认了交互细节：
- 单击项目项 → 继续对话（原有行为不变）
- 双击项目名 → 进入编辑模式，显示输入框
- 按回车或失去焦点 → 保存别名
- 按 ESC → 取消编辑
- 清空别名 → 恢复显示原始文件夹名

代码修改：
1. **electron/main.js**：添加 `getAliases()` / `saveAliases()` 辅助函数，从 `~/.claude/project-aliases.json` 读写别名；修改 `get-transcripts` handler 在返回 project 时带上 `displayName`；新增 `save-project-alias` handler。
2. **electron/preload.js**：暴露 `saveProjectAlias` API。
3. **src/App.jsx**：添加 `editingProject` 和 `editValue` state；修改侧边栏项目列表渲染逻辑，支持就地编辑；添加 `handleSaveAlias` 函数保存后刷新列表。
4. **src/index.css**：添加 `.sidebar-item-input` 样式。

用户成功运行了项目，并询问如何将修改后的应用更新到桌面的快捷方式。告知需要先 `npm run build` 再 `npm run pack`，新的可执行文件在 `release/win-unpacked/Claude Code Manager.exe`。

**当前项目路径**：`E:\claude code E\程序员\claude-code-manager`
**GitHub**：https://github.com/HeBeisheng/claude-code-gui
<!-- DYNAMIC_MEMORY_END -->
