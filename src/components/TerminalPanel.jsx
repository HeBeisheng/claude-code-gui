import React, { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import BottomHud from './BottomHud'

function TerminalPanel({ cwd, command, onReady, onPtyExit: onPtyExitProp, onClaudeStart, hasClaudeStarted, permissionMode, onPermissionChange, onForkConversation, mcpCount, canFork, terminalCount, maxTerminals, isActive }) {
  const terminalRef = useRef(null)
  const containerRef = useRef(null)
  const fitAddonRef = useRef(null)
  const inputBufferRef = useRef('')
  const autoRunRef = useRef({ enabled: false, skills: {} })
  const termInitializedRef = useRef(false)
  const currentPtyPid = useRef(null)
  const [isReady, setIsReady] = useState(false)
  const [status, setStatus] = useState('启动中...')

  // Load auto-run config once
  useEffect(() => {
    const loadAutoRun = async () => {
      try {
        const settings = await window.electronAPI.getSettings()
        const config = settings.global?.skillsAutoRun || { enabled: false, mode: 'local', skills: {} }
        autoRunRef.current = config
      } catch {}
    }
    loadAutoRun()
  }, [])

  // Initialize xterm once (never recreated)
  useEffect(() => {
    if (!containerRef.current || !window.electronAPI || termInitializedRef.current) return
    termInitializedRef.current = true

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', 'SF Mono', monospace",
      theme: {
        background: '#0a0a0a',
        foreground: '#e5e5e5',
        cursor: '#d4a574',
        selectionBackground: '#d4a57433',
        black: '#1a1a1a',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#facc15',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#e5e5e5',
        brightBlack: '#333',
        brightRed: '#fca5a5',
        brightGreen: '#86efac',
        brightYellow: '#fde047',
        brightBlue: '#93c5fd',
        brightMagenta: '#d8b4fe',
        brightCyan: '#67e8f9',
        brightWhite: '#fff'
      },
      scrollback: 10000,
      allowProposedApi: true
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    term.open(containerRef.current)
    fitAddon.fit()

    terminalRef.current = term
    fitAddonRef.current = fitAddon

    // 有选区时 Ctrl+C 复制到剪贴板，不发给 shell；没选区时正常中断
    term.attachCustomKeyEventHandler((e) => {
      if (e.ctrlKey && e.key === 'c' && term.hasSelection()) {
        navigator.clipboard.writeText(term.getSelection())
        return false
      }
      return true
    })

    // Handle PTY data -> terminal (filter by pid to avoid cross-talk between multiple panels)
    const cleanupData = window.electronAPI.onPtyData((payload) => {
      if (payload.pid === currentPtyPid.current) {
        term.write(payload.data)
      }
    })

    // Handle PTY exit (filter by pid)
    const cleanupExit = window.electronAPI.onPtyExit((payload) => {
      if (payload.pid === currentPtyPid.current) {
        setStatus(`终端已退出 (代码: ${payload.exitCode})`)
        setIsReady(false)
        currentPtyPid.current = null
        if (onPtyExitProp) onPtyExitProp(cwd)
      }
    })

    // Handle terminal input -> PTY (with auto-skill detection)
    term.onData((data) => {
      const config = autoRunRef.current
      if (config.enabled) {
        for (let i = 0; i < data.length; i++) {
          const ch = data.charCodeAt(i)
          if (ch === 13 || ch === 10) {
            const line = inputBufferRef.current.trim()
            if (line.length > 0) {
              detectAndInjectSkill(line, term)
              if (line === 'claude' || line.startsWith('claude ')) {
                onClaudeStart?.(cwd)
              }
            }
            inputBufferRef.current = ''
          } else if (ch === 127 || ch === 8) {
            inputBufferRef.current = inputBufferRef.current.slice(0, -1)
          } else if (ch >= 32 && ch < 127) {
            inputBufferRef.current += data[i]
          }
        }
      }
      window.electronAPI.ptyWrite(data)
    })

    function detectAndInjectSkill(line, termInstance) {
      const config = autoRunRef.current
      const skillNames = Object.keys(config.skills).filter(k => config.skills[k])
      if (skillNames.length === 0) return

      const lowerLine = line.toLowerCase()
      for (const name of skillNames) {
        if (lowerLine.includes(name.toLowerCase())) {
          const msg = `\r\n\x1b[38;2;212;165;116m[Skill 提示] 检测到「${name}」相关场景，已自动注入 Skill 上下文\x1b[0m\r\n`
          termInstance.write(msg)
          window.electronAPI.ptyWrite(`# Skill: ${name}\r\n`)
          break
        }
      }
    }

    // Handle resize
    const handleResize = () => {
      if (!fitAddonRef.current) return
      fitAddonRef.current.fit()
      const dims = fitAddonRef.current.proposeDimensions()
      if (dims) {
        window.electronAPI.ptyResize({ cols: dims.cols, rows: dims.rows })
      }
    }

    window.addEventListener('resize', handleResize)

    // Observe container size changes
    const resizeObserver = new ResizeObserver(() => {
      handleResize()
    })
    resizeObserver.observe(containerRef.current)

    // Initial resize
    const dims = fitAddon.proposeDimensions()
    if (dims) {
      window.electronAPI.ptyResize({ cols: dims.cols, rows: dims.rows })
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      resizeObserver.disconnect()
      cleanupData()
      cleanupExit()
      term.dispose()
    }
  }, [])

  // Manage PTY lifecycle (recreated when cwd or isActive changes, but xterm stays)
  useEffect(() => {
    if (!terminalRef.current || !window.electronAPI || !isActive) return

    const initPty = async () => {
      setStatus('正在连接终端...')
      setIsReady(false)

      // Kill existing PTY before creating new one
      await window.electronAPI.ptyKill()

      // Write separator when switching projects
      if (cwd) {
        const dirName = cwd.replace(/^.*[\\/]/, '')
        terminalRef.current.write(`\r\n\x1b[38;2;212;165;116m━━━ 切换到: ${dirName} ━━━\x1b[0m\r\n`)
      }

      const result = await window.electronAPI.ptyCreate({ cwd })
      if (result.error) {
        setStatus('错误: ' + result.error)
        terminalRef.current.write(`\r\n\x1b[31m启动终端失败: ${result.error}\x1b[0m\r\n`)
        if (cwd) {
          terminalRef.current.write(`\x1b[31m尝试目录: ${cwd}\x1b[0m\r\n`)
        }
        return
      }

      currentPtyPid.current = result.pid
      setStatus('就绪')
      setIsReady(true)
      if (onReady) onReady()

      // Send initial resize
      if (fitAddonRef.current) {
        const dims = fitAddonRef.current.proposeDimensions()
        if (dims) {
          await window.electronAPI.ptyResize({ cols: dims.cols, rows: dims.rows })
        }
      }

      // Auto-resume claude session if previously started in this project
      if (hasClaudeStarted) {
        setTimeout(() => {
          window.electronAPI.ptyWrite('claude --continue\r')
        }, 600)
      }

      // Auto-start command only if explicitly provided via prop
      if (command) {
        setTimeout(() => {
          window.electronAPI.ptyWrite(command + '\r')
        }, 600)
      }
    }

    initPty()

    // Cleanup: don't call ptyKill here because ptyCreate kills old PTY on next run.
    // Calling ptyKill async here could race with the new PTY.
  }, [cwd, isActive])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        ref={containerRef}
        style={{
          flex: 1,
          padding: '8px 12px',
          overflow: 'hidden',
          background: '#0a0a0a'
        }}
      />
      <BottomHud
        permissionMode={permissionMode}
        onPermissionChange={onPermissionChange}
        onForkConversation={onForkConversation}
        onStartClaude={() => {
          onClaudeStart?.(cwd)
          window.electronAPI.ptyWrite('claude\r')
        }}
        onContinue={() => {
          onClaudeStart?.(cwd)
          window.electronAPI.ptyWrite('claude --continue\r')
        }}
        mcpCount={mcpCount}
        canFork={canFork}
        terminalCount={terminalCount}
        maxTerminals={maxTerminals}
      />
      <div
        style={{
          height: '28px',
          background: '#111',
          borderTop: '1px solid #1c1c1c',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          fontSize: '11px',
          color: isReady ? '#4ade80' : '#888',
          gap: '8px'
        }}
      >
        <span style={{ fontSize: '10px' }}>{isReady ? '●' : '○'}</span>
        <span>{status}</span>
        {cwd && (
          <span style={{ color: '#555', marginLeft: 'auto' }}>
            {cwd.replace(/^.*[\\/]/, '')}
          </span>
        )}
      </div>
    </div>
  )
}

export default TerminalPanel
