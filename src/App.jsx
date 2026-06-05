import React, { useEffect, useState } from 'react'
import TerminalPanel from './components/TerminalPanel'
import SkillsPanel from './components/SkillsPanel'
import SettingsPanel from './components/SettingsPanel'
import FeatureMap from './components/FeatureMap'

function timeAgo(date) {
  if (!date) return ''
  const seconds = Math.floor((new Date() - new Date(date)) / 1000)
  if (seconds < 60) return '刚刚'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return new Date(date).toLocaleDateString()
}

function App() {
  const [activeView, setActiveView] = useState('terminal')
  const [activeCwd, setActiveCwd] = useState(null)
  const [projects, setProjects] = useState([])
  const [selectedProjectName, setSelectedProjectName] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    const data = await window.electronAPI.getTranscripts()
    setProjects(data.projects || [])
  }

  const handleNewChat = async () => {
    setIsLoading(true)
    const result = await window.electronAPI.selectDirectory()
    setIsLoading(false)
    if (result.path) {
      setActiveCwd(result.path)
      setSelectedProjectName(null)
      setActiveView('terminal')
    }
  }

  const handleContinueProject = async (project) => {
    setSelectedProjectName(project.name)

    if (project.cwd) {
      setActiveCwd(project.cwd)
      setActiveView('terminal')
      return
    }

    // If no cwd extracted, ask user to select
    setIsLoading(true)
    const result = await window.electronAPI.selectDirectory()
    setIsLoading(false)
    if (result.path) {
      setActiveCwd(result.path)
      setActiveView('terminal')
    }
  }

  const handleSendCommand = (cmd) => {
    window.electronAPI.ptyWrite(cmd + '\r')
    setActiveView('terminal')
  }

  const handleStartClaude = () => {
    handleSendCommand('claude')
  }

  return (
    <div className="app">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">Claude Code</div>
          <button
            className="btn-new-chat"
            onClick={handleNewChat}
            disabled={isLoading}
          >
            {isLoading ? '...' : '+ 新对话'}
          </button>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">
            最近对话
            <span className="sidebar-count">{projects.length}</span>
          </div>
          <div className="sidebar-list">
            {projects.length === 0 && (
              <div className="sidebar-empty">暂无历史对话</div>
            )}
            {projects.map(project => (
              <div
                key={project.name}
                className={`sidebar-item ${selectedProjectName === project.name ? 'active' : ''}`}
                onClick={() => handleContinueProject(project)}
                title={project.cwd || project.path}
              >
                <div className="sidebar-item-icon">📁</div>
                <div className="sidebar-item-info">
                  <div className="sidebar-item-name">{project.name}</div>
                  <div className="sidebar-item-meta">
                    {timeAgo(project.lastTime)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          <div
            className={`sidebar-footer-item ${activeView === 'featureMap' ? 'active' : ''}`}
            onClick={() => setActiveView('featureMap')}
          >
            <span>⚡</span> 功能地图
          </div>
          <div
            className={`sidebar-footer-item ${activeView === 'skills' ? 'active' : ''}`}
            onClick={() => setActiveView('skills')}
          >
            <span>◆</span> 技能开关
          </div>
          <div
            className={`sidebar-footer-item ${activeView === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveView('settings')}
          >
            <span>⚙</span> 设置
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-area">
        {/* Terminal is always mounted so sessions survive panel switching */}
        <div style={{ display: activeView === 'terminal' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <TerminalPanel key={activeCwd || 'default'} cwd={activeCwd} command={activeCwd ? 'claude' : null} />
        </div>

        {activeView === 'featureMap' && (
          <div className="panel-wrapper">
            <div className="panel-header">
              <h1 className="panel-title">功能地图</h1>
              <button className="btn-back" onClick={() => setActiveView('terminal')}>← 返回终端</button>
            </div>
            <FeatureMap onSendCommand={handleSendCommand} />
          </div>
        )}

        {activeView === 'skills' && (
          <div className="panel-wrapper">
            <div className="panel-header">
              <h1 className="panel-title">技能开关</h1>
              <button className="btn-back" onClick={() => setActiveView('terminal')}>← 返回终端</button>
            </div>
            <SkillsPanel />
          </div>
        )}

        {activeView === 'settings' && (
          <div className="panel-wrapper">
            <div className="panel-header">
              <h1 className="panel-title">设置</h1>
              <button className="btn-back" onClick={() => setActiveView('terminal')}>← 返回终端</button>
            </div>
            <SettingsPanel />
          </div>
        )}
      </div>
    </div>
  )
}

export default App
