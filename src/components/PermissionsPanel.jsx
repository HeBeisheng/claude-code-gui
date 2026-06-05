import React, { useEffect, useState } from 'react'

function PermissionsPanel() {
  const [settings, setSettings] = useState({})

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getSettings().then(setSettings)
    }
  }, [])

  const allAllows = []
  ;['global', 'globalLocal', 'project', 'projectLocal'].forEach(scope => {
    const perms = settings[scope]?.permissions?.allow || []
    perms.forEach(rule => {
      if (!allAllows.find(a => a.rule === rule)) {
        allAllows.push({ rule, scope })
      }
    })
  })

  const mode = settings.globalLocal?.permissions?.defaultMode
    || settings.global?.permissions?.defaultMode
    || 'default'

  const modes = [
    { key: 'default', label: '默认', desc: '写入、安装等危险操作需要确认', color: 'tag-yellow' },
    { key: 'auto', label: '自动', desc: '智能判断，低风险操作自动执行', color: 'tag-blue' },
    { key: 'acceptEdits', label: '接受编辑', desc: '文件编辑类操作自动允许', color: 'tag-green' },
    { key: 'bypassPermissions', label: '绕过权限', desc: '几乎所有操作自动执行，极少确认', color: 'tag-red' },
    { key: 'dontAsk', label: '不询问', desc: '极少弹窗，高度自动化', color: 'tag-red' },
    { key: 'plan', label: '计划模式', desc: '所有操作执行前都需要确认', color: 'tag-yellow' }
  ]

  const currentMode = modes.find(m => m.key === mode)

  return (
    <div>
      <h1 className="panel-title">权限管理</h1>
      <p className="panel-subtitle">查看当前权限模式和白名单规则</p>

      <div className="card">
        <div className="card-title">当前权限模式</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <span className={`tag ${currentMode?.color || 'tag-yellow'}`} style={{ fontSize: '14px', padding: '8px 16px' }}>
            {currentMode?.label || mode}
          </span>
          <span style={{ color: '#888', fontSize: '14px' }}>{currentMode?.desc || ''}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {modes.map(m => (
            <span key={m.key} className={`tag ${m.color}`} style={{ opacity: m.key === mode ? 1 : 0.4 }}>
              {m.label}
            </span>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">权限白名单 <span style={{ color: '#666', fontSize: '13px', fontWeight: 400 }}>({allAllows.length} 条规则)</span></div>
        {allAllows.length === 0 ? (
          <div className="card-empty">未找到权限白名单配置</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>规则</th>
                <th>来源</th>
              </tr>
            </thead>
            <tbody>
              {allAllows.map((item, i) => (
                <tr key={i}>
                  <td><code>{item.rule}</code></td>
                  <td><span className="tag tag-blue">{item.scope}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-title">模式说明</div>
        <table className="table">
          <thead>
            <tr><th>模式</th><th>说明</th><th>适用场景</th></tr>
          </thead>
          <tbody>
            {modes.map(m => (
              <tr key={m.key}>
                <td><span className={`tag ${m.color}`}>{m.label}</span></td>
                <td style={{ color: '#888' }}>{m.desc}</td>
                <td style={{ color: '#666', fontSize: '13px' }}>
                  {m.key === 'default' && '日常使用'}
                  {m.key === 'auto' && '追求效率'}
                  {m.key === 'acceptEdits' && '频繁改代码'}
                  {m.key === 'bypassPermissions' && '完全信任'}
                  {m.key === 'dontAsk' && '自动化脚本'}
                  {m.key === 'plan' && '谨慎操作'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PermissionsPanel
