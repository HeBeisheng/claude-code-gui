import React, { useEffect, useState } from 'react'

function Dashboard() {
  const [env, setEnv] = useState(null)
  const [settings, setSettings] = useState(null)
  const [skills, setSkills] = useState(null)

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getEnvInfo().then(setEnv)
      window.electronAPI.getSettings().then(setSettings)
      window.electronAPI.getSkills().then(setSkills)
    }
  }, [])

  const stats = [
    { label: '操作系统', value: env?.platform === 'win32' ? 'Windows' : env?.platform || '-', color: 'tag-blue' },
    { label: '全局配置', value: settings?.global ? '已配置' : '未配置', color: settings?.global ? 'tag-green' : 'tag-yellow' },
    { label: '本地配置', value: settings?.globalLocal ? '已配置' : '未配置', color: settings?.globalLocal ? 'tag-green' : 'tag-yellow' },
    { label: '用户技能', value: (skills?.user?.length || 0) + ' 个', color: 'tag-purple' },
    { label: '项目技能', value: (skills?.project?.length || 0) + ' 个', color: 'tag-purple' },
    { label: '配置目录', value: env?.claudeDir ? '已找到' : '未找到', color: env?.claudeDir ? 'tag-green' : 'tag-red' }
  ]

  return (
    <div>
      <h1 className="panel-title">概览</h1>
      <p className="panel-subtitle">查看 Claude Code 环境状态和快速访问常用功能</p>

      <div className="stat-grid">
        {stats.map((stat, i) => (
          <div key={i} className="stat-card">
            <div className="stat-label">{stat.label}</div>
            <span className={`tag ${stat.color}`}>{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">快速入口</div>
        <div className="quick-grid">
          <div className="quick-card">
            <div className="quick-card-title">⚙ 编辑配置</div>
            <div className="quick-card-desc">管理全局和项目级别的 settings.json 文件</div>
          </div>
          <div className="quick-card">
            <div className="quick-card-title">◆ 管理技能</div>
            <div className="quick-card-desc">查看和整理 ~/.claude/skills/ 下的自定义指令</div>
          </div>
          <div className="quick-card">
            <div className="quick-card-title">◇ MCP 服务器</div>
            <div className="quick-card-desc">配置外部工具连接和通信协议</div>
          </div>
          <div className="quick-card">
            <div className="quick-card-title">◐ 浏览历史</div>
            <div className="quick-card-desc">查看过往对话记录和会话详情</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">关于</div>
        <p style={{ fontSize: '14px', color: '#888', lineHeight: '1.7' }}>
          Claude Code Manager 是一个非官方的可视化管理工具，让你更方便地管理配置、技能、MCP 服务器和权限设置。
          所有变更会直接写入对应的 JSON 配置文件。
        </p>
      </div>
    </div>
  )
}

export default Dashboard
