import React, { useState, useEffect, useRef, useCallback } from 'react'

const MENU_ITEMS = [
  {
    label: '文件',
    items: [
      { label: '新对话', action: 'new-chat', shortcut: 'Ctrl+N' },
      { label: '打开目录', action: 'open-dir', shortcut: 'Ctrl+O' },
      { type: 'separator' },
      { label: '退出', action: 'quit', shortcut: 'Alt+F4' }
    ]
  },
  {
    label: '编辑',
    items: [
      { label: '剪切', action: 'cut', shortcut: 'Ctrl+X' },
      { label: '复制', action: 'copy', shortcut: 'Ctrl+C' },
      { label: '粘贴', action: 'paste', shortcut: 'Ctrl+V' }
    ]
  },
  {
    label: '查看',
    items: [
      { label: '终端', action: 'view-terminal', shortcut: '' },
      { label: '功能地图', action: 'view-feature', shortcut: '' },
      { label: '技能开关', action: 'view-skills', shortcut: '' },
      { label: '记忆', action: 'view-memory', shortcut: '' },
      { label: 'MCP', action: 'view-mcp', shortcut: '' },
      { label: '设置', action: 'view-settings', shortcut: '' },
      { type: 'separator' },
      { label: '刷新', action: 'reload', shortcut: 'Ctrl+R' },
      { label: '开发者工具', action: 'devtools', shortcut: 'F12' }
    ]
  },
  {
    label: '窗口',
    items: [
      { label: '最小化', action: 'minimize', shortcut: '' },
      { label: '最大化', action: 'maximize', shortcut: '' },
      { label: '全屏', action: 'fullscreen', shortcut: 'F11' }
    ]
  },
  {
    label: '帮助',
    items: [
      { label: '关于', action: 'about', shortcut: '' },
      { label: 'GitHub 仓库', action: 'github', shortcut: '' }
    ]
  }
]

function CustomTitleBar({ onMenuAction }) {
  const [activeMenu, setActiveMenu] = useState(null)
  const [isMaximized, setIsMaximized] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const checkMaximized = async () => {
      try {
        const result = await window.electronAPI.isWindowMaximized()
        setIsMaximized(result.isMaximized)
      } catch {}
    }
    checkMaximized()

    const handleResize = () => checkMaximized()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleMenuClick = useCallback((index) => {
    setActiveMenu(prev => prev === index ? null : index)
  }, [])

  const handleMenuItemClick = useCallback((item) => {
    setActiveMenu(null)
    if (item.action === 'minimize') {
      window.electronAPI.windowMinimize()
    } else if (item.action === 'maximize') {
      window.electronAPI.windowMaximize()
      setTimeout(async () => {
        const result = await window.electronAPI.isWindowMaximized()
        setIsMaximized(result.isMaximized)
      }, 100)
    } else if (item.action === 'quit') {
      window.electronAPI.windowClose()
    } else if (item.action === 'reload') {
      window.location.reload()
    } else if (item.action === 'devtools') {
      // DevTools can only be opened from main process, notify via custom action
      onMenuAction?.(item.action)
    } else if (item.action === 'fullscreen') {
      // Toggle fullscreen via a custom action if needed
      onMenuAction?.(item.action)
    } else {
      onMenuAction?.(item.action)
    }
  }, [onMenuAction])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenu(null)
      }
    }
    if (activeMenu !== null) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [activeMenu])

  const handleMinimize = () => window.electronAPI.windowMinimize()
  const handleMaximize = async () => {
    await window.electronAPI.windowMaximize()
    const result = await window.electronAPI.isWindowMaximized()
    setIsMaximized(result.isMaximized)
  }
  const handleClose = () => window.electronAPI.windowClose()

  return (
    <div
      className="custom-titlebar"
      style={{
        height: '38px',
        background: 'linear-gradient(180deg, #161821 0%, #13151c 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 0 0 12px',
        WebkitAppRegion: 'drag',
        userSelect: 'none',
        flexShrink: 0,
        zIndex: 9999,
        position: 'relative'
      }}
    >
      {/* Left: Menu */}
      <div
        ref={menuRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          WebkitAppRegion: 'no-drag'
        }}
      >
        {/* App icon / logo */}
        <div style={{
          fontSize: '13px',
          fontWeight: 700,
          color: '#d4a574',
          marginRight: '12px',
          letterSpacing: '0.5px'
        }}>
          Claude Code
        </div>

        {MENU_ITEMS.map((menu, index) => (
          <div key={menu.label} style={{ position: 'relative' }}>
            <button
              onClick={() => handleMenuClick(index)}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: 'none',
                background: activeMenu === index ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                color: activeMenu === index ? '#e5e5e5' : '#888',
                fontSize: '12px',
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                fontWeight: 500
              }}
              onMouseEnter={e => {
                if (activeMenu !== null) {
                  setActiveMenu(index)
                }
                e.currentTarget.style.color = '#e5e5e5'
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
              }}
              onMouseLeave={e => {
                if (activeMenu !== index) {
                  e.currentTarget.style.color = '#888'
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              {menu.label}
            </button>

            {activeMenu === index && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: '0',
                minWidth: '180px',
                background: 'linear-gradient(145deg, rgba(22, 25, 34, 0.98) 0%, rgba(17, 19, 26, 0.98) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '8px',
                padding: '6px',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(16px)',
                zIndex: 10000,
                WebkitAppRegion: 'no-drag'
              }}>
                {menu.items.map((item, i) => (
                  item.type === 'separator' ? (
                    <div key={i} style={{
                      height: '1px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      margin: '4px 0'
                    }} />
                  ) : (
                    <div
                      key={i}
                      onClick={() => handleMenuItemClick(item)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        fontSize: '12px',
                        color: '#ccc',
                        transition: 'all 0.1s ease'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
                        e.currentTarget.style.color = '#e5e5e5'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = '#ccc'
                      }}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && (
                        <span style={{ color: '#555', fontSize: '11px', whiteSpace: 'nowrap' }}>{item.shortcut}</span>
                      )}
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Right: Window Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        height: '100%',
        WebkitAppRegion: 'no-drag'
      }}>
        <button
          onClick={handleMinimize}
          className="titlebar-btn"
          title="最小化"
          style={{
            width: '46px',
            height: '100%',
            border: 'none',
            background: 'transparent',
            color: '#888',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            fontSize: '14px'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
            e.currentTarget.style.color = '#e5e5e5'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#888'
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <rect x="0" y="5" width="12" height="2" rx="0.5" />
          </svg>
        </button>
        <button
          onClick={handleMaximize}
          className="titlebar-btn"
          title={isMaximized ? '还原' : '最大化'}
          style={{
            width: '46px',
            height: '100%',
            border: 'none',
            background: 'transparent',
            color: '#888',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            fontSize: '14px'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
            e.currentTarget.style.color = '#e5e5e5'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#888'
          }}
        >
          {isMaximized ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3 0v3H0v9h9v-3h3V0H3zm5 10H1V4h7v6zm2-3H9V3H4V1h6v6z" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <rect x="0" y="0" width="12" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          )}
        </button>
        <button
          onClick={handleClose}
          className="titlebar-btn titlebar-close"
          title="关闭"
          style={{
            width: '46px',
            height: '100%',
            border: 'none',
            background: 'transparent',
            color: '#888',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            fontSize: '14px'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#e81123'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#888'
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default CustomTitleBar
