import React, { useEffect, useRef, useState } from 'react'

function SettingsPanel() {
  const [settings, setSettings] = useState({})
  const [activeScope, setActiveScope] = useState('globalLocal')
  const [jsonText, setJsonText] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const [isBuilding, setIsBuilding] = useState(false)
  const [buildLogs, setBuildLogs] = useState([])
  const [buildDone, setBuildDone] = useState(false)
  const [buildSuccess, setBuildSuccess] = useState(false)
  const [hiddenProjects, setHiddenProjects] = useState([])
  const logEndRef = useRef(null)

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getSettings().then(data => {
        setSettings(data)
        const initial = data[activeScope]
        setJsonText(initial ? JSON.stringify(initial, null, 2) : '{}')
      })
      loadHiddenProjects()
    }
  }, [])

  useEffect(() => {
    const scopeData = settings[activeScope]
    setJsonText(scopeData ? JSON.stringify(scopeData, null, 2) : '{}')
    setSaveStatus('')
  }, [activeScope])

  useEffect(() => {
    if (!window.electronAPI) return
    const cleanupOutput = window.electronAPI.onBuildOutput((data) => {
      setBuildLogs(prev => [...prev, data])
    })
    const cleanupDone = window.electronAPI.onBuildDone(({ success, error }) => {
      setIsBuilding(false)
      setBuildDone(true)
      setBuildSuccess(success)
      if (error) {
        setBuildLogs(prev => [...prev, { step: 'error', status: 'failed', message: error }])
      }
    })
    return () => {
      cleanupOutput()
      cleanupDone()
    }
  }, [])

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [buildLogs])

  const handleSave = async () => {
    try {
      const data = JSON.parse(jsonText)
      const result = await window.electronAPI.saveSettings({ scope: activeScope, data })
      if (result.success) {
        setSaveStatus('保存成功')
        setSettings(prev => ({ ...prev, [activeScope]: data }))
      } else {
        setSaveStatus('保存失败: ' + result.error)
      }
    } catch (err) {
      setSaveStatus('JSON 格式错误')
    }
  }

  const handleBuild = async () => {
    setIsBuilding(true)
    setBuildDone(false)
    setBuildSuccess(false)
    setBuildLogs([{ step: 'init', status: 'start', message: '开始打包流程...' }])
    const result = await window.electronAPI.buildApp()
    if (result.error && !buildDone) {
      setIsBuilding(false)
      setBuildDone(true)
      setBuildSuccess(false)
      setBuildLogs(prev => [...prev, { step: 'error', status: 'failed', message: result.error }])
    }
  }

  const handleOpenRelease = async () => {
    await window.electronAPI.openReleaseFolder()
  }

  const loadHiddenProjects = async () => {
    const data = await window.electronAPI.getHiddenProjects()
    setHiddenProjects(data.hidden || [])
  }

  const handleUnhideProject = async (projectName) => {
    await window.electronAPI.unhideProject({ projectName })
    loadHiddenProjects()
  }

  const scopes = [
    { key: 'global', label: '全局', path: '~/.claude/settings.json' },
    { key: 'globalLocal', label: '全局本地', path: '~/.claude/settings.local.json' },
    { key: 'project', label: '项目', path: '.claude/settings.json' },
    { key: 'projectLocal', label: '项目本地', path: '.claude/settings.local.json' }
  ]

  const configHelp = [
    { key: 'permissions.allow', type: '数组', desc: '权限白名单规则列表' },
    { key: 'permissions.defaultMode', type: '字符串', desc: '默认权限模式：default / auto / acceptEdits / bypassPermissions / dontAsk / plan' },
    { key: 'model', type: '字符串', desc: '默认使用的 AI 模型' },
    { key: 'theme', type: '字符串', desc: '界面主题：auto / dark / light' },
    { key: 'editorMode', type: '字符串', desc: '编辑器模式：normal / vim' },
    { key: 'verbose', type: '布尔', desc: '显示完整的工具调用输出' },
    { key: 'autoCompactEnabled', type: '布尔', desc: '自动压缩过长的对话上下文' },
    { key: 'fileCheckpointingEnabled', type: '布尔', desc: '编辑文件前自动创建备份快照' },
    { key: 'enableAllProjectMcpServers', type: '布尔', desc: '自动启用项目内所有 MCP 服务器' },
    { key: 'enabledMcpjsonServers', type: '数组', desc: '显式启用的 MCP 服务器名称列表' }
  ]

  return (
    <div>
      <h1 className="panel-title">设置编辑器</h1>
      <p className="panel-subtitle">直接编辑 Claude Code 的四层配置文件</p>

      <div className="scope-tabs">
        {scopes.map(s => (
          <button
            key={s.key}
            className={`scope-tab ${activeScope === s.key ? 'active' : ''}`}
            onClick={() => setActiveScope(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: '12px', fontSize: '12px', color: '#666' }}>
        当前文件: <code>{scopes.find(s => s.key === activeScope)?.path}</code>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #1c1c1c' }}>
          <span style={{ fontSize: '13px', color: '#888', fontWeight: 500 }}>JSON 编辑器</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {saveStatus && (
              <span className={saveStatus === '保存成功' ? 'status-success' : 'status-error'} style={{ fontSize: '13px', fontWeight: 500 }}>
                {saveStatus}
              </span>
            )}
            <button className="btn btn-primary" onClick={handleSave}>保存更改</button>
          </div>
        </div>
        <textarea
          className="form-textarea"
          style={{ borderRadius: 0, border: 'none', minHeight: '360px' }}
          value={jsonText}
          onChange={e => { setJsonText(e.target.value); setSaveStatus('') }}
          spellCheck={false}
        />
      </div>

      <div className="card" style={{ background: 'rgba(212, 165, 116, 0.03)', borderColor: 'rgba(212, 165, 116, 0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div className="card-title" style={{ margin: 0 }}>重新打包应用</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {buildDone && buildSuccess && (
              <button className="btn btn-secondary" onClick={handleOpenRelease}>打开 release 文件夹</button>
            )}
            <button
              className="btn btn-primary"
              onClick={handleBuild}
              disabled={isBuilding}
            >
              {isBuilding ? '打包中...' : '重新打包'}
            </button>
          </div>
        </div>
        <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
          点击后会依次执行 <code>npm run build</code> → <code>npm run pack</code>，生成最新的桌面应用。
        </p>
        {(isBuilding || buildDone) && (
          <div
            style={{
              background: '#0a0a0a',
              border: '1px solid #1c1c1c',
              borderRadius: '8px',
              padding: '12px 16px',
              fontSize: '12px',
              fontFamily: "'Cascadia Code', 'Consolas', monospace",
              color: '#888',
              maxHeight: '240px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.6'
            }}
          >
            {buildLogs.map((log, i) => (
              <div key={i} style={{
                color: log.step === 'error' ? '#f87171' : log.step === 'done' ? '#4ade80' : '#888'
              }}>
                {log.message}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}
        {buildDone && (
          <div style={{
            marginTop: '12px',
            fontSize: '13px',
            fontWeight: 500,
            color: buildSuccess ? '#4ade80' : '#f87171'
          }}>
            {buildSuccess ? '打包完成！点击上方按钮打开 release 文件夹。' : '打包失败，请查看上方日志。'}
          </div>
        )}
      </div>

      <div className="card" style={{ background: 'rgba(248, 113, 113, 0.03)', borderColor: 'rgba(248, 113, 113, 0.15)' }}>
        <div className="card-title" style={{ color: '#fca5a5' }}>已隐藏的项目</div>
        <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
          以下项目被从侧边栏列表中移除，但原始对话数据仍保留在 ~/.claude/projects/ 中。恢复后它们会重新出现在列表里。
        </p>
        {hiddenProjects.length === 0 ? (
          <div style={{ fontSize: '13px', color: '#555', padding: '8px 0' }}>暂无隐藏的项目</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {hiddenProjects.map(p => (
              <div
                key={p.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.04)'
                }}
              >
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ fontSize: '13px', color: '#ccc', fontWeight: 500 }}>{p.displayName || p.name}</div>
                  {p.cwd && <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{p.cwd}</div>}
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '11px', flexShrink: 0, marginLeft: '10px' }}
                  onClick={() => handleUnhideProject(p.name)}
                >
                  恢复显示
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">常用配置项参考</div>
        <table className="table">
          <thead>
            <tr>
              <th>配置项</th>
              <th>类型</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            {configHelp.map(item => (
              <tr key={item.key}>
                <td><code>{item.key}</code></td>
                <td><span className="tag tag-blue">{item.type}</span></td>
                <td style={{ color: '#888' }}>{item.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default SettingsPanel
