import React, { useEffect, useState } from 'react'

function McpPanel({ cwd }) {
  const [mcpJson, setMcpJson] = useState(null)
  const [enabledServers, setEnabledServers] = useState([])
  const [source, setSource] = useState('none')
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editJson, setEditJson] = useState('')
  const [saveStatus, setSaveStatus] = useState('')

  const loadData = async () => {
    setLoading(true)
    const data = await window.electronAPI.getMcpServers({ cwd })
    setMcpJson(data.mcpJson || { mcpServers: {} })
    setEnabledServers(data.enabledServers || [])
    setSource(data.source || 'none')
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [cwd])

  const servers = mcpJson?.mcpServers || {}

  const handleToggle = async (name) => {
    const isEnabled = enabledServers.includes(name)
    await window.electronAPI.toggleMcpServer({ name, enable: !isEnabled })
    loadData()
  }

  const handleDelete = async (name) => {
    if (!confirm(`确定删除 MCP 服务器 "${name}" 吗？`)) return
    const newServers = { ...servers }
    delete newServers[name]
    const result = await window.electronAPI.saveMcpConfig({
      scope: source === 'project' ? 'project' : 'global',
      data: { mcpServers: newServers },
      cwd
    })
    if (result.success) {
      loadData()
    } else {
      alert('删除失败: ' + result.error)
    }
  }

  const handleShowAddJson = () => {
    setEditJson(JSON.stringify({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', cwd || '/path'],
      description: '文件系统访问'
    }, null, 2))
    setShowAddForm(true)
    setSaveStatus('')
  }

  const handleSaveNew = async () => {
    try {
      const config = JSON.parse(editJson)
      const name = config.name || 'new-server'
      delete config.name

      const newServers = { ...servers, [name]: config }
      const result = await window.electronAPI.saveMcpConfig({
        scope: cwd ? 'project' : 'global',
        data: { mcpServers: newServers },
        cwd
      })
      if (result.success) {
        setShowAddForm(false)
        loadData()
      } else {
        setSaveStatus('保存失败: ' + result.error)
      }
    } catch (err) {
      setSaveStatus('JSON 格式错误: ' + err.message)
    }
  }

  const handleAddBuiltinDesktopControl = async () => {
    const builtin = await window.electronAPI.getBuiltinMcpServer()
    if (!builtin.exists) {
      alert('内置服务器文件未找到')
      return
    }
    const serverPath = builtin.path
    const name = 'desktop-control'
    if (servers[name]) {
      alert('电脑操控服务器已存在')
      return
    }
    const newServers = {
      ...servers,
      [name]: {
        command: process.execPath,
        args: [serverPath],
        description: '电脑操控 - 截图、鼠标、键盘控制（Windows 内置）'
      }
    }
    const result = await window.electronAPI.saveMcpConfig({
      scope: cwd ? 'project' : 'global',
      data: { mcpServers: newServers },
      cwd
    })
    if (result.success) {
      loadData()
    } else {
      alert('添加失败: ' + result.error)
    }
  }

  if (loading) return <div className="card-empty">正在加载 MCP 配置...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 className="panel-title" style={{ margin: 0 }}>MCP 服务器</h1>
        <button className="btn btn-primary" onClick={handleShowAddJson}>+ 添加服务器</button>
      </div>
      <p className="panel-subtitle">管理 Model Context Protocol 外部工具连接 · 当前配置来源: {source === 'project' ? '项目级' : source === 'global' ? '全局' : '无'}</p>

      {showAddForm && (
        <div className="card" style={{ background: 'rgba(212, 165, 116, 0.03)', borderColor: 'rgba(212, 165, 116, 0.2)' }}>
          <div className="card-title">添加新服务器</div>
          <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
            在 JSON 中添加 <code>name</code> 字段作为服务器名称
          </p>
          <textarea
            className="form-textarea"
            style={{ minHeight: '200px', fontSize: '13px' }}
            value={editJson}
            onChange={e => { setEditJson(e.target.value); setSaveStatus('') }}
            spellCheck={false}
          />
          {saveStatus && <div style={{ marginTop: '8px', fontSize: '13px', color: '#f87171' }}>{saveStatus}</div>}
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
            <button className="btn btn-secondary" onClick={() => setShowAddForm(false)}>取消</button>
            <button className="btn btn-primary" onClick={handleSaveNew}>保存</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">已配置的服务器 <span style={{ color: '#666', fontSize: '13px', fontWeight: 400 }}>({Object.keys(servers).length})</span></div>
        {Object.keys(servers).length === 0 ? (
          <div className="card-empty">暂无 MCP 服务器，点击上方按钮添加</div>
        ) : (
          <div className="skill-list">
            {Object.entries(servers).map(([name, config]) => {
              const isEnabled = enabledServers.includes(name)
              return (
                <div key={name} className="skill-row">
                  <div className="skill-info">
                    <div className="skill-name">{name}</div>
                    <div className="skill-desc">{config.description || '暂无描述'}</div>
                    <div style={{ marginTop: '6px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {config.command && <span style={{ fontSize: '11px', color: '#888' }}>命令: <code>{config.command}</code></span>}
                      {config.url && <span style={{ fontSize: '11px', color: '#888' }}>地址: <code>{config.url}</code></span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => handleToggle(name)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => handleDelete(name)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ background: 'rgba(212, 165, 116, 0.03)', borderColor: 'rgba(212, 165, 116, 0.15)' }}>
        <div className="card-title">推荐服务器</div>
        <div className="skill-row">
          <div className="skill-info">
            <div className="skill-name">电脑操控</div>
            <div className="skill-desc">Windows 内置桌面控制 - 截图、鼠标移动点击、键盘输入，无需额外安装</div>
          </div>
          <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={handleAddBuiltinDesktopControl}>
            + 添加
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">关于 MCP</div>
        <p style={{ fontSize: '14px', color: '#888', lineHeight: '1.7' }}>
          MCP（Model Context Protocol）是 Claude Code 与外部工具通信的标准协议。
          通过配置 MCP 服务器，你可以让 Claude 调用文件系统、数据库、浏览器、API 等外部能力。
          开关状态保存在 ~/.claude/settings.json 的 enabledMcpjsonServers 中。
        </p>
      </div>
    </div>
  )
}

export default McpPanel
