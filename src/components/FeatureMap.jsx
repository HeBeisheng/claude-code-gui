import React from 'react'

const categories = [
  {
    title: '会话控制',
    desc: '管理当前对话的状态和上下文',
    items: [
      { name: '清空上下文', cmd: '/clear', desc: '清除之前的对话记忆，让 Claude 重新聚焦' },
      { name: '压缩历史', cmd: '/compact', desc: '把长对话压缩成摘要，节省 token' },
      { name: '查看用量', cmd: '/cost', desc: '显示本次会话的 token 消耗和预估费用' },
      { name: '退出 Claude', cmd: '/exit', desc: '安全退出 Claude Code 并保存日志' },
      { name: '查看帮助', cmd: '/help', desc: '列出所有可用的斜杠命令' }
    ]
  },
  {
    title: '快捷提问',
    desc: '一键发送常用指令到 Claude',
    items: [
      { name: '分析目录结构', cmd: '分析当前项目的目录结构和主要文件', desc: '让 Claude 快速了解项目架构' },
      { name: '总结修改内容', cmd: '总结一下最近修改了哪些文件', desc: '查看自上次提交以来的变更' },
      { name: '查找 TODO', cmd: '帮我在代码里查找所有的 TODO 和 FIXME', desc: '定位未完成的任务标记' },
      { name: '代码审查', cmd: '请审查最近的代码修改，指出潜在问题', desc: '让 Claude 检查代码质量' },
      { name: '生成文档', cmd: '帮给主要函数生成注释文档', desc: '自动补充代码说明' }
    ]
  },
  {
    title: '文件操作',
    desc: 'Claude 可以直接读写你的文件',
    items: [
      { name: '读取文件', cmd: '请读取并解释这个文件的内容', desc: 'Claude 会询问你要读哪个文件' },
      { name: '修改文件', cmd: '帮我修改这个文件，实现以下功能', desc: '描述需求，Claude 自动编辑' },
      { name: '创建文件', cmd: '请创建一个名为 xxx 的文件，内容是', desc: '让 Claude 新建文件' },
      { name: '搜索内容', cmd: '帮我在项目里搜索包含 xxx 的文件', desc: '全局文本搜索' }
    ]
  },
  {
    title: '命令执行',
    desc: 'Claude 可以运行终端命令并解释结果',
    items: [
      { name: '运行测试', cmd: '请运行测试并告诉我结果', desc: '自动执行 test 命令' },
      { name: '安装依赖', cmd: '帮我安装需要的依赖', desc: '自动运行 npm install 等' },
      { name: 'Git 状态', cmd: '查看当前的 git 状态', desc: '显示分支、修改、提交信息' },
      { name: '构建项目', cmd: '请构建项目并检查是否有错误', desc: '运行 build 命令' }
    ]
  },
  {
    title: '启动参数',
    desc: '启动 Claude 时可以附加的参数（需手动输入）',
    items: [
      { name: '跳过权限确认', cmd: 'claude --dangerously-skip-permissions', desc: '自动允许所有操作（谨慎使用）', isParam: true },
      { name: '详细模式', cmd: 'claude --verbose', desc: '显示更多内部运行信息', isParam: true },
      { name: '指定目录', cmd: 'claude /path/to/project', desc: '直接在指定目录启动', isParam: true }
    ]
  }
]

function FeatureMap({ onSendCommand }) {
  const handleClick = (item) => {
    if (item.isParam) {
      // For launch params, just copy to clipboard or show info
      onSendCommand(item.cmd)
    } else {
      onSendCommand(item.cmd)
    }
  }

  return (
    <div>
      <p className="panel-subtitle">
        像 Photoshop 快捷键鼠标垫一样，这里列出了 Claude Code 的常用功能和对应指令。点击任意卡片即可发送到终端执行。
      </p>

      {categories.map(cat => (
        <div key={cat.title} className="card" style={{ marginBottom: '20px' }}>
          <div className="card-title">{cat.title}</div>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>{cat.desc}</p>
          <div className="feature-grid">
            {cat.items.map(item => (
              <div
                key={item.name}
                className="feature-card"
                onClick={() => handleClick(item)}
                title="点击发送到终端"
              >
                <div className="feature-name">{item.name}</div>
                <code className="feature-cmd">{item.cmd}</code>
                <div className="feature-desc">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="card" style={{ background: 'rgba(212, 165, 116, 0.05)', borderColor: 'rgba(212, 165, 116, 0.15)' }}>
        <div className="card-title">💡 使用提示</div>
        <ul style={{ fontSize: '14px', color: '#888', lineHeight: '2', paddingLeft: '20px' }}>
          <li>Claude Code 理解自然语言，你可以直接用中文描述需求</li>
          <li>斜杠命令（如 /clear）需要在对话中输入，不是在系统终端里输入</li>
          <li>启动参数（如 --dangerously-skip-permissions）是在启动 claude 时附加的</li>
          <li>Claude 修改文件前会询问你，输入 Y 同意，N 拒绝</li>
          <li>随时按 Ctrl+C 可以中断 Claude 正在执行的操作</li>
        </ul>
      </div>
    </div>
  )
}

export default FeatureMap
