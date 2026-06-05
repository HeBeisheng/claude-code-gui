import React, { useEffect, useState } from 'react'

function SkillsPanel() {
  const [skills, setSkills] = useState({ user: { enabled: [], disabled: [] }, project: { enabled: [], disabled: [] } })
  const [loading, setLoading] = useState(true)

  const loadSkills = async () => {
    setLoading(true)
    const data = await window.electronAPI.getSkills()
    setSkills(data)
    setLoading(false)
  }

  useEffect(() => {
    loadSkills()
  }, [])

  const handleToggle = async (scope, name, enable) => {
    const result = await window.electronAPI.toggleSkill({ scope, name, enable })
    if (result.error) {
      alert('操作失败: ' + result.error)
      return
    }
    // Refresh list
    loadSkills()
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
            return (
              <div key={skill.name} className="skill-row">
                <div className="skill-info">
                  <div className="skill-name">{skill.name}</div>
                  <div className="skill-desc">{skill.description || '暂无描述'}</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => handleToggle(scope, skill.name, !isEnabled)}
                  />
                  <span className="toggle-slider"></span>
                </label>
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
          在对话中输入 <code>/技能名</code> 即可调用对应的技能。
          关闭开关会将技能移到 skills-disabled 文件夹，打开则会移回来。
        </p>
      </div>
    </div>
  )
}

export default SkillsPanel
