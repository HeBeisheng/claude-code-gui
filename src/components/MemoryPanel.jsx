import React, { useEffect, useState } from 'react'

function MemoryPanel({ cwd, projectName }) {
  const [memory, setMemory] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [otherMemories, setOtherMemories] = useState([])
  const [showOther, setShowOther] = useState(false)

  useEffect(() => {
    if (cwd) {
      loadMemory()
    }
  }, [cwd])

  const loadMemory = async () => {
    if (!cwd) return
    setLoading(true)
    const data = await window.electronAPI.getProjectMemory(cwd)
    setMemory(data.content || '')
    setLoading(false)
    setSaved(false)
  }

  const handleSave = async () => {
    if (!cwd) return
    setLoading(true)
    await window.electronAPI.saveProjectMemory({ cwd, content: memory })
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleGenerate = async () => {
    if (!cwd) return
    setLoading(true)
    const data = await window.electronAPI.generateMemory({ cwd, projectName })
    if (data.content) {
      setMemory(data.content)
    }
    setLoading(false)
    setSaved(false)
  }

  const loadOtherMemoriesList = async () => {
    const data = await window.electronAPI.getAllMemories()
    setOtherMemories(data.memories || [])
    setShowOther(true)
  }

  const handleLoadOther = async (memoryPath) => {
    const data = await window.electronAPI.loadOtherMemory(memoryPath)
    if (data.content) {
      setMemory(prev => prev + '\n\n---\n\n**其他项目记忆**\n\n' + data.content)
    }
  }

  if (!cwd) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
        <div style={{ fontSize: '14px', color: '#555', marginBottom: '8px' }}>请先选择一个项目</div>
        <div style={{ fontSize: '13px', color: '#444' }}>在左侧历史列表中点击一个项目，或新建对话</div>
      </div>
    )
  }

  return (
    <div>
      <div className="panel-header">
        <h1 className="panel-title">对话记忆</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary btn" onClick={handleGenerate} disabled={loading}>
            {loading ? '生成中...' : '🔄 自动生成'}
          </button>
          <button className={`btn ${saved ? 'btn-active' : 'btn-primary'}`} onClick={handleSave} disabled={loading}>
            {saved ? '已保存' : '💾 保存记忆'}
          </button>
        </div>
      </div>

      <p className="panel-subtitle">
        这是当前项目的"交接班日志"。每次退出前会自动提醒保存，下次打开时新 AI 会读到这些内容，知道你是谁、做到哪了。
      </p>

      <div className="card">
        <textarea
          className="form-textarea"
          style={{ minHeight: '400px' }}
          value={memory}
          onChange={(e) => { setMemory(e.target.value); setSaved(false) }}
          placeholder="记忆内容..."
        />
      </div>

      <div className="card">
        <div className="card-title">加载其他项目的记忆</div>
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>
          如果你需要参考其他项目的上下文，可以在这里加载它们的记忆。
        </p>
        {!showOther ? (
          <button className="btn-secondary btn" onClick={loadOtherMemoriesList}>查看其他项目记忆</button>
        ) : (
          <div className="skill-list">
            {otherMemories.length === 0 && (
              <div style={{ color: '#555', fontSize: '13px' }}>暂无其他项目的记忆</div>
            )}
            {otherMemories.map(m => (
              <div key={m.projectName} className="skill-row">
                <div className="skill-info">
                  <div className="skill-name">{m.projectName}</div>
                  <div className="skill-desc">{m.preview}</div>
                </div>
                <button className="btn-secondary btn" onClick={() => handleLoadOther(m.path)}>加载</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default MemoryPanel
