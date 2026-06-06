import React, { useEffect, useRef, useState } from 'react'

const PERMISSION_MODES = [
  { value: 'plan', label: '低', desc: '计划模式', color: '#60a5fa' },
  { value: 'default', label: '中', desc: '标准模式', color: '#facc15' },
  { value: 'auto', label: '高', desc: '自动批准', color: '#f87171' }
]

function BottomHud({ permissionMode, onPermissionChange, onForkConversation, onStartClaude, onContinue, mcpCount, canFork, terminalCount, maxTerminals }) {
  const currentMode = PERMISSION_MODES.find(m => m.value === permissionMode) || PERMISSION_MODES[1]
  const [skills, setSkills] = useState([])
  const [showSkillPanel, setShowSkillPanel] = useState(false)
  const panelRef = useRef(null)

  useEffect(() => {
    loadSkills()
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setShowSkillPanel(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadSkills = async () => {
    try {
      const data = await window.electronAPI.getSkills({})
      const enabled = [
        ...(data.user?.enabled || []),
        ...(data.project?.enabled || [])
      ]
      setSkills(enabled)
    } catch {
      setSkills([])
    }
  }

  const handleSkillClick = async (skill) => {
    setShowSkillPanel(false)
    try {
      const data = await window.electronAPI.getSkillContent({ skillPath: skill.path })
      const content = data.content || ''
      if (content) {
        window.electronAPI.ptyWrite(content + '\r')
      } else {
        window.electronAPI.ptyWrite(`# Skill: ${skill.name}\r`)
      }
    } catch {
      window.electronAPI.ptyWrite(`# Skill: ${skill.name}\r`)
    }
  }


  return (
    <div className="bottom-hud">
      <div className="hud-left">
        <button
          className="hud-btn"
          onClick={onForkConversation}
          disabled={!canFork}
          title="基于当前对话新建分支"
        >
          <span style={{ fontSize: '13px' }}>🔀</span>
          <span>分支</span>
        </button>

        <button
          className="hud-btn"
          onClick={onContinue}
          title="继续最近对话 (claude --continue)"
        >
          <span style={{ fontSize: '13px' }}>↩</span>
          <span>继续</span>
        </button>

        <button
          className="hud-btn"
          onClick={onStartClaude}
          title="启动 Claude"
        >
          <span style={{ fontSize: '13px' }}>▶</span>
          <span>Claude</span>
        </button>

        <div style={{ position: 'relative' }} ref={panelRef}>
          <button
            className="hud-btn"
            onClick={() => setShowSkillPanel(v => !v)}
            title="Skill 指令"
          >
            <span style={{ fontSize: '13px' }}>◆</span>
            <span>Skill</span>
          </button>

          {showSkillPanel && (
            <div style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              left: '0',
              width: '240px',
              background: 'linear-gradient(145deg, rgba(22, 25, 34, 0.98) 0%, rgba(17, 19, 26, 0.98) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '12px',
              padding: '10px',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(16px)',
              zIndex: 100
            }}>
              <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px', padding: '0 4px' }}>
                已启用 Skill ({skills.length})
              </div>
              {skills.length === 0 && (
                <div style={{ fontSize: '12px', color: '#555', padding: '8px 4px' }}>暂无启用的 Skill</div>
              )}
              {skills.map(skill => (
                <div
                  key={skill.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    marginBottom: '4px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                    gap: '8px'
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '13px', color: '#ccc', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skill.name}</div>
                    {skill.description && (
                      <div style={{ fontSize: '11px', color: '#666', marginTop: '2px', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skill.description}</div>
                    )}
                  </div>
                  <button
                    onClick={() => handleSkillClick(skill)}
                    style={{
                      flexShrink: 0,
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      background: 'rgba(212, 165, 116, 0.1)',
                      border: '1px solid rgba(212, 165, 116, 0.2)',
                      color: '#d4a574',
                      fontFamily: 'inherit',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(212, 165, 116, 0.2)'
                      e.currentTarget.style.borderColor = 'rgba(212, 165, 116, 0.4)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(212, 165, 116, 0.1)'
                      e.currentTarget.style.borderColor = 'rgba(212, 165, 116, 0.2)'
                    }}
                  >
                    粘贴
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="hud-center">
        <span style={{ fontSize: '11px', color: '#555', marginRight: '8px' }}>权限</span>
        <div className="hud-permission-bar">
          {PERMISSION_MODES.map(mode => (
            <button
              key={mode.value}
              className={`hud-permission-btn ${permissionMode === mode.value ? 'active' : ''}`}
              onClick={() => onPermissionChange(mode.value)}
              title={mode.desc}
              style={{
                '--active-color': mode.color
              }}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div className="hud-right">
        <div className="hud-mcp-indicator" title="缓存终端数">
          <span style={{ fontSize: '12px' }}>🖥</span>
          <span style={{ fontSize: '11px', color: terminalCount >= maxTerminals ? '#f87171' : '#888' }}>
            {terminalCount}/{maxTerminals}
          </span>
        </div>
        <div className="hud-mcp-indicator" title="MCP 服务器">
          <span style={{ fontSize: '12px' }}>⚡</span>
          <span style={{ fontSize: '11px', color: mcpCount > 0 ? '#4ade80' : '#555' }}>
            MCP {mcpCount}
          </span>
        </div>
      </div>
    </div>
  )
}

export default BottomHud
