import React, { useEffect, useState, useRef } from 'react'
import TerminalPanel from './components/TerminalPanel'
import SkillsPanel from './components/SkillsPanel'
import SettingsPanel from './components/SettingsPanel'
import FeatureMap from './components/FeatureMap'
import MemoryPanel from './components/MemoryPanel'
import McpPanel from './components/McpPanel'
import CustomTitleBar from './components/CustomTitleBar'

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
  const [showQuitDialog, setShowQuitDialog] = useState(false)
  const [memoryContent, setMemoryContent] = useState('')
  const [isGeneratingMemory, setIsGeneratingMemory] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [updateState, setUpdateState] = useState({
    available: false,
    downloaded: false,
    version: null,
    progress: 0
  })
  const [permissionMode, setPermissionMode] = useState('default')
  const [mcpCount, setMcpCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedProjects, setExpandedProjects] = useState({})
  const [showRecentDropdown, setShowRecentDropdown] = useState(false)
  const [projectOrder, setProjectOrder] = useState([])
  const [collapsedSections, setCollapsedSections] = useState({})
  const [terminals, setTerminals] = useState({})
  const [evictDialog, setEvictDialog] = useState(null)
  const [isSavingMemory, setIsSavingMemory] = useState(false)
  const [claudeStartedMap, setClaudeStartedMap] = useState({})
  const [contextMenu, setContextMenu] = useState(null)
  const prevTerminalsRef = useRef({})
  const searchRef = useRef(null)

  const MAX_TERMINALS = 8

  const applyProjectOrder = (projectList, orderList) => {
    if (!orderList || orderList.length === 0) return projectList
    const orderMap = new Map(orderList.map((name, index) => [name, index]))
    const sorted = [...projectList].sort((a, b) => {
      const ia = orderMap.get(a.name)
      const ib = orderMap.get(b.name)
      if (ia !== undefined && ib !== undefined) return ia - ib
      if (ia !== undefined) return -1
      if (ib !== undefined) return 1
      return 0
    })
    return sorted
  }

  const filteredProjects = searchQuery
    ? projects.filter(p =>
        (p.displayName || p.name).toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.cwd || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : projects

  const casualChats = filteredProjects.filter(p => p.isCasual)
  const projectChats = filteredProjects.filter(p => !p.isCasual)

  useEffect(() => {
    loadProjects()
    loadPermissionMode()
    loadMcpCount()

    // Listen for quit confirmation from main process
    const cleanupQuit = window.electronAPI.onAskSaveMemory(() => {
      setShowQuitDialog(true)
    })

    // Auto update listeners
    const cleanupUpdateAvailable = window.electronAPI.onUpdateAvailable((data) => {
      setUpdateState(prev => ({ ...prev, available: true, version: data?.version }))
    })
    const cleanupUpdateProgress = window.electronAPI.onUpdateProgress((data) => {
      setUpdateState(prev => ({ ...prev, progress: data?.percent || 0 }))
    })
    const cleanupUpdateDownloaded = window.electronAPI.onUpdateDownloaded((data) => {
      setUpdateState(prev => ({ ...prev, downloaded: true, version: data?.version }))
    })
    const cleanupUpdateError = window.electronAPI.onUpdateError(() => {
      // Silently ignore auto-update errors (e.g. no network, not packaged)
    })

    return () => {
      cleanupQuit()
      cleanupUpdateAvailable()
      cleanupUpdateProgress()
      cleanupUpdateDownloaded()
      cleanupUpdateError()
    }
  }, [])

  const loadProjects = async () => {
    const data = await window.electronAPI.getTranscripts()
    const orderData = await window.electronAPI.getProjectOrder()
    const order = orderData.order || []
    setProjectOrder(order)
    const list = data.projects || []
    setProjects(applyProjectOrder(list, order))
  }

  // Cache terminal instances per cwd (方案B：独立标签页)
  useEffect(() => {
    const key = activeCwd || '__default__'
    setTerminals(prev => {
      if (prev[key]) return prev
      const next = { ...prev, [key]: true }
      const keys = Object.keys(next)
      if (keys.length > MAX_TERMINALS) {
        const toRemove = keys.find(k => k !== key)
        if (toRemove) delete next[toRemove]
      }
      return next
    })
  }, [activeCwd])

  // Detect evicted terminals and prompt for memory save
  useEffect(() => {
    const prevKeys = Object.keys(prevTerminalsRef.current)
    const currentKeys = Object.keys(terminals)
    const removedKey = prevKeys.find(k => !terminals[k])
    prevTerminalsRef.current = terminals

    if (removedKey && removedKey !== '__default__') {
      const cwd = removedKey
      setEvictDialog({ cwd, projectName: null })
    }
  }, [terminals])

  // Click outside to close search dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowRecentDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close context menu on click anywhere
  useEffect(() => {
    if (!contextMenu) return
    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [contextMenu])

  const handleNewChat = async () => {
    setIsLoading(true)
    const result = await window.electronAPI.selectDirectory()
    setIsLoading(false)
    if (result.path) {
      setActiveCwd(result.path)
      setSelectedProjectName(null)
      setActiveView('terminal')
      await window.electronAPI.saveSession({ cwd: result.path })
      loadProjects()
    }
  }

  const handleNewCasualChat = async () => {
    setIsLoading(true)
    const result = await window.electronAPI.selectDirectory()
    setIsLoading(false)
    if (result.path) {
      setActiveCwd(result.path)
      setSelectedProjectName(null)
      setActiveView('terminal')
      await window.electronAPI.saveSession({ cwd: result.path, isCasual: true })
      loadProjects()
    }
  }

  const handleContinueProject = async (project) => {
    setSelectedProjectName(project.name)

    if (project.cwd) {
      setActiveCwd(project.cwd)
      setActiveView('terminal')
      await window.electronAPI.saveSession({ cwd: project.cwd })
      // 不调用 loadProjects()：避免点击后项目跳到列表顶部
      return
    }

    // If no cwd extracted, ask user to select
    setIsLoading(true)
    const result = await window.electronAPI.selectDirectory()
    setIsLoading(false)
    if (result.path) {
      setActiveCwd(result.path)
      setActiveView('terminal')
      await window.electronAPI.saveSession({ cwd: result.path })
      loadProjects()
    }
  }

  const handleSendCommand = (cmd) => {
    window.electronAPI.ptyWrite(cmd + '\r')
    setActiveView('terminal')
  }

  const handlePtyExit = (cwd) => {
    const key = cwd || '__default__'
    setTerminals(prev => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const handleClaudeStart = (cwd) => {
    const key = cwd || '__default__'
    setClaudeStartedMap(prev => {
      if (prev[key]) return prev
      return { ...prev, [key]: true }
    })
  }

  const handleEvictSave = async () => {
    if (!evictDialog?.cwd) {
      setEvictDialog(null)
      return
    }
    setIsSavingMemory(true)
    const data = await window.electronAPI.generateMemory({ cwd: evictDialog.cwd, projectName: evictDialog.projectName })
    setIsSavingMemory(false)
    if (data.content) {
      await window.electronAPI.saveProjectMemory({ cwd: evictDialog.cwd, content: data.content })
    }
    setEvictDialog(null)
  }

  const handleEvictDiscard = () => {
    setEvictDialog(null)
  }

  const loadPermissionMode = async () => {
    const data = await window.electronAPI.getPermissionMode()
    if (data.mode) setPermissionMode(data.mode)
  }

  const loadMcpCount = async () => {
    const data = await window.electronAPI.getMcpServers()
    if (data.mcpJson?.mcpServers) {
      setMcpCount(Object.keys(data.mcpJson.mcpServers).length)
    }
  }

  const handlePermissionChange = async (mode) => {
    setPermissionMode(mode)
    await window.electronAPI.setPermissionMode({ mode })
  }

  const handleForkConversation = async () => {
    if (!activeCwd) return
    // Simplified fork: save current memory, create new session with same cwd
    const result = await window.electronAPI.generateMemory({ cwd: activeCwd, projectName: selectedProjectName })
    if (result.content) {
      await window.electronAPI.saveProjectMemory({ cwd: activeCwd, content: result.content })
    }
    // Create a new branch session
    const dirName = activeCwd.replace(/^.*[\\/]/, '')
    const branchName = `${selectedProjectName || dirName}-分支-${Date.now()}`
    const sessionResult = await window.electronAPI.saveSession({ cwd: activeCwd, displayName: branchName })
    if (sessionResult.id) {
      setSelectedProjectName(sessionResult.id)
    }
    loadProjects()
  }

  const handleSaveAlias = async (projectName, displayName) => {
    setEditingProject(null)
    setEditValue('')
    await window.electronAPI.saveProjectAlias({ projectName, displayName })
    loadProjects()
  }

  const handleContextMenu = (e, project) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, project })
  }

  const handlePinProject = async (projectName) => {
    const newOrder = [projectName, ...projectOrder.filter(n => n !== projectName)]
    setProjectOrder(newOrder)
    setProjects(prev => applyProjectOrder(prev, newOrder))
    await window.electronAPI.saveProjectOrder({ order: newOrder })
    setContextMenu(null)
  }

  const handleHideProject = async (projectName) => {
    await window.electronAPI.hideProject({ projectName })
    loadProjects()
    setContextMenu(null)
  }

  const handleEditAliasFromMenu = (project) => {
    setEditingProject(project.name)
    setEditValue(project.displayName || project.name)
    setContextMenu(null)
  }

  const toggleExpandProject = (projectName) => {
    setExpandedProjects(prev => ({ ...prev, [projectName]: !prev[projectName] }))
  }

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const handleStartClaude = () => {
    handleSendCommand('claude')
  }

  const handleQuitSave = async () => {
    setIsGeneratingMemory(true)
    const data = await window.electronAPI.generateMemory({ cwd: activeCwd, projectName: selectedProjectName })
    setIsGeneratingMemory(false)
    if (data.content) {
      await window.electronAPI.confirmQuit({ save: true, memoryData: { cwd: activeCwd, content: data.content } })
    } else {
      await window.electronAPI.confirmQuit({ save: false })
    }
  }

  const handleQuitWithoutSave = async () => {
    await window.electronAPI.confirmQuit({ save: false })
  }

  const handleQuitCancel = () => {
    setShowQuitDialog(false)
  }

  const handleInstallUpdate = async () => {
    await window.electronAPI.quitAndInstall()
  }

  const renderProjectList = (list) => (
    <div className="sidebar-list">
      {list.length === 0 && (
        <div className="sidebar-empty">{searchQuery ? '无匹配项目' : '暂无历史项目'}</div>
      )}
      {list.map(project => (
        <div key={project.name}>
          <div
            className={`sidebar-item ${selectedProjectName === project.name ? 'active' : ''}`}
            title={project.cwd || project.path}
            draggable
            onContextMenu={(e) => handleContextMenu(e, project)}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', project.name)
              e.currentTarget.style.opacity = '0.5'
            }}
            onDragEnd={(e) => {
              e.currentTarget.style.opacity = '1'
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
            }}
            onDragLeave={(e) => {
              e.currentTarget.style.background = ''
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.currentTarget.style.background = ''
              const draggedName = e.dataTransfer.getData('text/plain')
              if (draggedName && draggedName !== project.name) {
                const newProjects = [...projects]
                const fromIndex = newProjects.findIndex(p => p.name === draggedName)
                const toIndex = newProjects.findIndex(p => p.name === project.name)
                if (fromIndex >= 0 && toIndex >= 0) {
                  const [removed] = newProjects.splice(fromIndex, 1)
                  newProjects.splice(toIndex, 0, removed)
                  setProjects(newProjects)
                  const newOrder = newProjects.map(p => p.name)
                  setProjectOrder(newOrder)
                  window.electronAPI.saveProjectOrder({ order: newOrder })
                }
              }
            }}
          >
            <div
              className="sidebar-item-expand"
              onClick={(e) => {
                e.stopPropagation()
                toggleExpandProject(project.name)
              }}
            >
              {expandedProjects[project.name] ? (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1 3L5 7L9 3" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M3 1L7 5L3 9" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div className="sidebar-item-icon">{project.isCasual ? '💬' : '📁'}</div>
            <div className="sidebar-item-info" onClick={() => handleContinueProject(project)}>
              {editingProject === project.name ? (
                <input
                  autoFocus
                  className="sidebar-item-input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSaveAlias(project.name, editValue)
                    } else if (e.key === 'Escape') {
                      setEditingProject(null)
                      setEditValue('')
                    }
                  }}
                  onBlur={() => handleSaveAlias(project.name, editValue)}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div
                  className="sidebar-item-name"
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    setEditingProject(project.name)
                    setEditValue(project.displayName || project.name)
                  }}
                >
                  {project.displayName || project.name}
                </div>
              )}
              <div className="sidebar-item-meta" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {project.cwd || project.path}
                </span>
                {project.displayName && (
                  <span style={{ color: '#444', flexShrink: 0 }}>{timeAgo(project.lastTime)}</span>
                )}
              </div>
            </div>
          </div>
          {expandedProjects[project.name] && project.files && project.files.length > 0 && (
            <div style={{ paddingLeft: '28px', marginTop: '2px', marginBottom: '4px' }}>
              {project.files.slice(0, 5).map(file => (
                <div
                  key={file.name}
                  style={{
                    padding: '5px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: '#555',
                    cursor: 'pointer',
                    transition: 'all 0.1s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
                    e.currentTarget.style.color = '#888'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = '#555'
                  }}
                >
                  <span style={{ fontSize: '10px' }}>📝</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </span>
                  <span style={{ marginLeft: 'auto', color: '#333', fontSize: '10px', flexShrink: 0 }}>
                    {timeAgo(file.mtime)}
                  </span>
                </div>
              ))}
              {project.files.length > 5 && (
                <div style={{ padding: '4px 8px', fontSize: '11px', color: '#333' }}>
                  还有 {project.files.length - 5} 个对话...
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )

  const handleMenuAction = (action) => {
    switch (action) {
      case 'new-chat':
        handleNewChat()
        break
      case 'open-dir':
        handleNewChat()
        break
      case 'view-terminal':
        setActiveView('terminal')
        break
      case 'view-feature':
        setActiveView('featureMap')
        break
      case 'view-skills':
        setActiveView('skills')
        break
      case 'view-memory':
        setActiveView('memory')
        break
      case 'view-mcp':
        setActiveView('mcp')
        break
      case 'view-settings':
        setActiveView('settings')
        break
      case 'reload':
        window.location.reload()
        break
      case 'devtools':
        window.electronAPI.toggleDevTools()
        break
      case 'fullscreen':
        window.electronAPI.toggleFullscreen()
        break
      case 'about':
        alert('Claude Code Manager v1.0.0\nCAFA中央美术学院大一学生出品')
        break
      case 'github':
        window.electronAPI.openExternal('https://github.com/HeBeisheng/claude-code-gui')
        break
      default:
        break
    }
  }

  return (
    <div className="app" style={{ flexDirection: 'column' }}>
      <CustomTitleBar onMenuAction={handleMenuAction} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Quit Dialog */}
      {showQuitDialog && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-title">保存对话记忆？</div>
            <div className="modal-body">
              退出前保存本次对话的记忆，下次打开时新 AI 能知道你是谁、做到哪了。
              {isGeneratingMemory && <div style={{ marginTop: '12px', color: '#888' }}>正在生成记忆...</div>}
            </div>
            <div className="modal-actions">
              <button className="btn-secondary btn" onClick={handleQuitCancel}>取消</button>
              <button className="btn-secondary btn" onClick={handleQuitWithoutSave}>不保存</button>
              <button className="btn-primary btn" onClick={handleQuitSave} disabled={isGeneratingMemory}>
                {isGeneratingMemory ? '生成中...' : '保存并退出'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Eviction Dialog */}
      {evictDialog && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-title">终端缓存已满</div>
            <div className="modal-body">
              「{evictDialog.cwd ? evictDialog.cwd.replace(/^.*[\\/]/, '') : '未命名'}」的对话缓存将被释放。
              是否保存该对话的记忆？
              {isSavingMemory && <div style={{ marginTop: '12px', color: '#888' }}>正在生成记忆...</div>}
            </div>
            <div className="modal-actions">
              <button className="btn-secondary btn" onClick={handleEvictDiscard}>不保存</button>
              <button className="btn-primary btn" onClick={handleEvictSave} disabled={isSavingMemory}>
                {isSavingMemory ? '生成中...' : '保存记忆'}
              </button>
            </div>
          </div>
        </div>
      )}

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
          <button
            className="btn-new-chat"
            onClick={handleNewCasualChat}
            disabled={isLoading}
            style={{
              marginTop: '6px',
              background: 'transparent',
              border: '1px dashed #2a2d3a',
              color: '#888',
              fontSize: '12px'
            }}
          >
            💬 快速对话
          </button>
          <div className="sidebar-search" ref={searchRef} style={{ position: 'relative', marginTop: '10px' }}>
            <input
              type="text"
              placeholder="搜索项目..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowRecentDropdown(true)}
            />
            {showRecentDropdown && !searchQuery && projects.length > 0 && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: '0',
                right: '0',
                background: 'linear-gradient(145deg, rgba(22, 25, 34, 0.98) 0%, rgba(17, 19, 26, 0.98) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '10px',
                padding: '8px',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(16px)',
                zIndex: 50,
                maxHeight: '280px',
                overflowY: 'auto'
              }}>
                <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px', padding: '0 4px' }}>最近对话</div>
                {projects.slice(0, 6).map(project => (
                  <div
                    key={project.name}
                    onClick={() => {
                      setShowRecentDropdown(false)
                      handleContinueProject(project)
                    }}
                    style={{
                      padding: '7px 8px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: '#ccc',
                      transition: 'all 0.1s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <span style={{ fontSize: '11px', opacity: 0.5 }}>📁</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {project.displayName || project.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sidebar-section">
          {casualChats.length > 0 && (
            <>
              <div
                className="sidebar-section-title"
                onClick={() => toggleSection('casual')}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{
                    transform: collapsedSections.casual ? 'rotate(-90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s ease'
                  }}>
                    <path d="M1 3L5 7L9 3" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  对话
                </span>
                <span className="sidebar-count">{casualChats.length}</span>
              </div>
              {!collapsedSections.casual && renderProjectList(casualChats)}
            </>
          )}
          {projectChats.length > 0 && (
            <>
              <div
                className="sidebar-section-title"
                onClick={() => toggleSection('project')}
                style={{ cursor: 'pointer', userSelect: 'none', marginTop: casualChats.length > 0 ? '16px' : '0' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{
                    transform: collapsedSections.project ? 'rotate(-90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s ease'
                  }}>
                    <path d="M1 3L5 7L9 3" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  项目
                </span>
                <span className="sidebar-count">{projectChats.length}</span>
              </div>
              {!collapsedSections.project && renderProjectList(projectChats)}
            </>
          )}
          {filteredProjects.length === 0 && (
            <div className="sidebar-empty" style={{ padding: '40px 8px' }}>
              {searchQuery ? '无匹配项目' : '暂无历史项目'}
            </div>
          )}
        </div>

        {updateState.available && (
          <div style={{
            padding: '10px 14px',
            background: updateState.downloaded ? 'rgba(74, 222, 128, 0.08)' : 'rgba(212, 165, 116, 0.08)',
            borderTop: `1px solid ${updateState.downloaded ? 'rgba(74, 222, 128, 0.15)' : 'rgba(212, 165, 116, 0.15)'}`,
            fontSize: '12px',
            color: updateState.downloaded ? '#4ade80' : '#d4a574'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {updateState.downloaded
                  ? `v${updateState.version} 已下载就绪`
                  : `发现新版本 v${updateState.version}，正在下载... ${updateState.progress > 0 ? `${updateState.progress}%` : ''}`}
              </span>
              {updateState.downloaded && (
                <button
                  className="btn btn-primary"
                  style={{ padding: '4px 10px', fontSize: '11px', flexShrink: 0 }}
                  onClick={handleInstallUpdate}
                >
                  重启安装
                </button>
              )}
            </div>
            {!updateState.downloaded && updateState.progress > 0 && (
              <div style={{
                height: '2px',
                background: 'rgba(212, 165, 116, 0.15)',
                borderRadius: '1px',
                marginTop: '8px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${updateState.progress}%`,
                  background: '#d4a574',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            )}
          </div>
        )}

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
            className={`sidebar-footer-item ${activeView === 'memory' ? 'active' : ''}`}
            onClick={() => setActiveView('memory')}
          >
            <span>📝</span> 记忆
          </div>
          <div
            className={`sidebar-footer-item ${activeView === 'mcp' ? 'active' : ''}`}
            onClick={() => setActiveView('mcp')}
          >
            <span>⚡</span> MCP
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
        {/* Terminal tabs: each cached cwd gets its own TerminalPanel instance */}
        <div style={{ display: activeView === 'terminal' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          {Object.keys(terminals).map(key => {
            const isDefault = key === '__default__'
            const cwd = isDefault ? null : key
            const isActive = (activeCwd || '__default__') === key
            return (
              <div
                key={key}
                style={{ display: isActive ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}
              >
                <TerminalPanel
                  cwd={cwd}
                  permissionMode={permissionMode}
                  onPermissionChange={handlePermissionChange}
                  onForkConversation={handleForkConversation}
                  onPtyExit={handlePtyExit}
                  onClaudeStart={handleClaudeStart}
                  hasClaudeStarted={!!claudeStartedMap[key]}
                  mcpCount={mcpCount}
                  canFork={!!cwd}
                  terminalCount={Object.keys(terminals).length}
                  maxTerminals={MAX_TERMINALS}
                  isActive={isActive}
                />
              </div>
            )
          })}
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
            <SkillsPanel cwd={activeCwd} />
          </div>
        )}

        {activeView === 'memory' && (
          <div className="panel-wrapper">
            <div className="panel-header">
              <h1 className="panel-title">对话记忆</h1>
              <button className="btn-back" onClick={() => setActiveView('terminal')}>← 返回终端</button>
            </div>
            <MemoryPanel cwd={activeCwd} projectName={selectedProjectName} />
          </div>
        )}

        {activeView === 'mcp' && (
          <div className="panel-wrapper">
            <div className="panel-header">
              <h1 className="panel-title">MCP 服务器</h1>
              <button className="btn-back" onClick={() => setActiveView('terminal')}>← 返回终端</button>
            </div>
            <McpPanel cwd={activeCwd} />
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

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 10000
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-menu-item" onClick={() => handlePinProject(contextMenu.project.name)}>
            <span>📌</span> 置顶
          </div>
          <div className="context-menu-item" onClick={() => handleEditAliasFromMenu(contextMenu.project)}>
            <span>✏️</span> 编辑别名
          </div>
          <div className="context-menu-separator" />
          <div className="context-menu-item danger" onClick={() => handleHideProject(contextMenu.project.name)}>
            <span>🗑️</span> 从列表移除
          </div>
        </div>
      )}
    </div>
  )
}

export default App
