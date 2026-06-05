import React, { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

function TerminalPanel({ cwd, command, onReady }) {
  const terminalRef = useRef(null)
  const containerRef = useRef(null)
  const fitAddonRef = useRef(null)
  const [isReady, setIsReady] = useState(false)
  const [status, setStatus] = useState('启动中...')

  useEffect(() => {
    if (!containerRef.current || !window.electronAPI) return

    // Initialize xterm
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

    // Create PTY
    const initPty = async () => {
      setStatus('正在连接终端...')
      const result = await window.electronAPI.ptyCreate({ cwd })
      if (result.error) {
        setStatus('错误: ' + result.error)
        term.writeln(`\r\n\x1b[31m启动终端失败: ${result.error}\x1b[0m`)
        return
      }

      setStatus('就绪')
      setIsReady(true)
      if (onReady) onReady()

      // Send initial resize
      const dims = fitAddon.proposeDimensions()
      if (dims) {
        await window.electronAPI.ptyResize({ cols: dims.cols, rows: dims.rows })
      }

      // Auto-start command if provided
      if (command) {
        setTimeout(() => {
          window.electronAPI.ptyWrite(command + '\r')
        }, 600)
      }
    }

    initPty()

    // Handle PTY data -> terminal
    const cleanupData = window.electronAPI.onPtyData((data) => {
      term.write(data)
    })

    // Handle PTY exit
    const cleanupExit = window.electronAPI.onPtyExit(({ exitCode }) => {
      setStatus(`终端已退出 (代码: ${exitCode})`)
      setIsReady(false)
    })

    // Handle terminal input -> PTY
    term.onData((data) => {
      window.electronAPI.ptyWrite(data)
    })

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

    return () => {
      window.removeEventListener('resize', handleResize)
      resizeObserver.disconnect()
      cleanupData()
      cleanupExit()
      window.electronAPI.ptyKill()
      term.dispose()
    }
  }, [cwd]) // Re-init when cwd changes

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
