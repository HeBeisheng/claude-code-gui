import React, { useEffect, useState } from 'react'

function SkillsPanel({ cwd }) {
  const [skills, setSkills] = useState({ user: { enabled: [], disabled: [] }, project: { enabled: [], disabled: [] } })
  const [loading, setLoading] = useState(true)
  const [autoRunConfig, setAutoRunConfig] = useState({ enabled: false, mode: 'local', skills: {} })
  const [savingAutoRun, setSavingAutoRun] = useState(false)

  const loadSkills = async () => {
    setLoading(true)
    const [skillData, settingsData] = await Promise.all([
      window.electronAPI.getSkills({ cwd }),
      window.electronAPI.getSettings()
    ])
    setSkills(skillData)
    const globalSettings = settingsData.global || {}
    setAutoRunConfig(globalSettings.skillsAutoRun || { enabled: false, mode: 'local', skills: {} })
    setLoading(false)
  }

  useEffect(() => {
    loadSkills()
  }, [cwd])

  const handleToggle = async (scope, name, enable) => {
    const result = await window.electronAPI.toggleSkill({ scope, name, enable, cwd })
    if (result.error) {
      alert('操作失败: ' + result.error)
      return
    }
    loadSkills()
  }

  const saveAutoRun = async (newConfig) => {
    setSavingAutoRun(true)
    const settings = await window.electronAPI.getSettings()
    const globalSettings = settings.global || {}
    globalSettings.skillsAutoRun = newConfig
    await window.electronAPI.saveSettings({ scope: 'global', data: globalSettings })
    setAutoRunConfig(newConfig)
    setSavingAutoRun(false)
  }

  const toggleAutoRunGlobal = () => {
    saveAutoRun({ ...autoRunConfig, enabled: !autoRunConfig.enabled })
  }

  const toggleAutoRunMode = () => {
    const newMode = autoRunConfig.mode === 'global' ? 'local' : 'global'
    saveAutoRun({ ...autoRunConfig, mode: newMode })
  }

  const toggleSkillAutoRun = (skillName) => {
    const newSkills = { ...autoRunConfig.skills, [skillName]: !autoRunConfig.skills[skillName] }
    if (!newSkills[skillName]) delete newSkills[skillName]
    saveAutoRun({ ...autoRunConfig, skills: newSkills })
  }

  const SkillSection = ({ title, scope, data }) => {
    const allSkills = [...data.enabled, ...data.disabled]
    if (allSkills.length === 0) return null

    return (
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-title">{title} <span style={{ color: '#666', fontSize: '13px', fontWeight: 400 }}>({allSkills.length})</span></div>
        <div className="skill-list">
          {allSkills.map(skill => {
            const isEnabled = data.enabled.some(s => s.name === skill.name)
            const isAutoRun = !!autoRunConfig.skills[skill.name]
            return (
              <div key={skill.name} className="skill-row">
                <div className="skill-info">
                  <div className="skill-name">{skill.name}</div>
                  <div className="skill-desc">{skill.description || '暂无描述'}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {isEnabled && (
                    <button
                      className="btn btn-secondary"
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        opacity: autoRunConfig.enabled ? 1 : 0.4,
                        background: isAutoRun ? 'rgba(212, 165, 116, 0.15)' : undefined,
                        color: isAutoRun ? '#d4a574' : undefined,
                        borderColor: isAutoRun ? 'rgba(212, 165, 116, 0.3)' : undefined
                      }}
                      onClick={() => toggleSkillAutoRun(skill.name)}
                      disabled={!autoRunConfig.enabled || savingAutoRun}
                      title={isAutoRun ? '已启用自动运行' : '点击启用自动运行'}
                    >
                      {isAutoRun ? '自动: 开' : '自动: 关'}
                    </button>
                  )}
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => handleToggle(scope, skill.name, !isEnabled)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (loading) return <div className="card-empty">正在加载技能列表...</div>

  const hasAnySkills =
    skills.user.enabled.length + skills.user.disabled.length +
    skills.project.enabled.length + skills.project.disabled.length > 0

  return (
    <div>
      <div className="card" style={{ marginBottom: '20px', background: 'rgba(212, 165, 116, 0.03)', borderColor: 'rgba(212, 165, 116, 0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div className="card-title" style={{ margin: 0 }}>自动运行</div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={autoRunConfig.enabled}
              onChange={toggleAutoRunGlobal}
              disabled={savingAutoRun}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        <p style={{ fontSize: '13px', color: '#888', lineHeight: '1.6', marginBottom: '12px' }}>
          开启后，Terminal 会检测你的输入内容。当检测到与某个启用自动运行的 Skill 相关的关键词时，会自动在对话中提示启用该 Skill。
        </p>
        {autoRunConfig.enabled && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`scope-tab ${autoRunConfig.mode === 'global' ? 'active' : ''}`}
              onClick={toggleAutoRunMode}
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              {autoRunConfig.mode === 'global' ? '全局生效' : '仅当前项目'}
            </button>
          </div>
        )}
      </div>

      {!hasAnySkills && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <div style={{ fontSize: '14px', color: '#555', marginBottom: '8px' }}>未找到任何技能</div>
          <div style={{ fontSize: '13px', color: '#444' }}>在 ~/.claude/skills/ 目录下放置技能文件夹即可自动识别</div>
        </div>
      )}

      <SkillSection title="用户级技能" scope="user" data={skills.user} />
      <SkillSection title="项目级技能" scope="project" data={skills.project} />

      <div className="card" style={{ background: 'rgba(212, 165, 116, 0.05)', borderColor: 'rgba(212, 165, 116, 0.15)' }}>
        <div className="card-title">什么是技能？</div>
        <p style={{ fontSize: '14px', color: '#888', lineHeight: '1.7' }}>
          技能（Skills）是 Claude Code 的可复用指令模块，存放在 <code>~/.claude/skills/</code> 或项目 <code>.claude/skills/</code> 目录下。
          每个技能是一个文件夹，包含 frontmatter（名称、描述）和 Markdown 格式的指令内容。
          关闭开关会将技能移到 skills-disabled 文件夹，打开则会移回来。
        </p>
      </div>
    </div>
  )
}

export default SkillsPanel
