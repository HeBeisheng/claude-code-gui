const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { spawn } = require('child_process')
const pty = require('node-pty')
const { autoUpdater } = require('electron-updater')

let mainWindow
let isQuitting = false

const CLAUDE_DIR = path.join(os.homedir(), '.claude')
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects')

// Store PTY instances per window
const ptyProcesses = new Map()

function getSettingsPath(local = false) {
  const cwd = process.cwd()
  const projectSettings = path.join(cwd, '.claude', local ? 'settings.local.json' : 'settings.json')
  const globalSettings = path.join(CLAUDE_DIR, local ? 'settings.local.json' : 'settings.json')
  if (fs.existsSync(projectSettings)) return projectSettings
  return globalSettings
}

function createWindow() {
  const isWin = process.platform === 'win32'
  const iconPath = path.join(__dirname, '..', 'build', isWin ? 'icon.ico' : 'icon.png')

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    frame: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Explicitly set icon on Windows for better taskbar support
  if (isWin && fs.existsSync(iconPath)) {
    mainWindow.setIcon(iconPath)
  }

  Menu.setApplicationMenu(null)

  const isDev = !app.isPackaged
  const distFile = path.join(__dirname, '../dist/index.html')
  const hasDist = fs.existsSync(distFile)

  if (isDev && !hasDist) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(distFile)
    if (isDev) mainWindow.webContents.openDevTools()
  }

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow.webContents.send('ask-save-memory')
    }
  })

  mainWindow.on('closed', () => {
    // Clean up PTY
    const ptyProcess = ptyProcesses.get(mainWindow.id)
    if (ptyProcess) {
      ptyProcess.kill()
      ptyProcesses.delete(mainWindow.id)
    }
    mainWindow = null
  })
}

// Quit confirmation from renderer
ipcMain.handle('confirm-quit', async (event, { save, memoryData }) => {
  if (save && memoryData) {
    try {
      const memoryPath = path.join(memoryData.cwd, '.claude', 'memory.md')
      const dir = path.dirname(memoryPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(memoryPath, memoryData.content, 'utf8')

      // Also update CLAUDE.md with memory section
      const claudeMdPath = path.join(memoryData.cwd, 'CLAUDE.md')
      if (fs.existsSync(claudeMdPath)) {
        let claudeMd = fs.readFileSync(claudeMdPath, 'utf8')
        const memorySection = `\n\n<!-- DYNAMIC_MEMORY_START -->\n# 对话记忆\n\n${memoryData.content}\n<!-- DYNAMIC_MEMORY_END -->`
        if (claudeMd.includes('<!-- DYNAMIC_MEMORY_START -->')) {
          claudeMd = claudeMd.replace(/<!-- DYNAMIC_MEMORY_START -->[\s\S]*?<!-- DYNAMIC_MEMORY_END -->/, memorySection)
        } else {
          claudeMd += memorySection
        }
        fs.writeFileSync(claudeMdPath, claudeMd, 'utf8')
      }
    } catch (err) {
      console.error('Save memory failed:', err)
    }
  }
  isQuitting = true
  app.quit()
})

// ===================== PTY IPC =====================

ipcMain.handle('pty-create', async (event, { cwd, shell } = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return { error: 'No window found' }

  // Kill existing PTY for this window
  const existing = ptyProcesses.get(win.id)
  if (existing) {
    existing.kill()
    ptyProcesses.delete(win.id)
  }

  const isWin = process.platform === 'win32'
  const shellPath = shell || (isWin ? 'powershell.exe' : process.env.SHELL || 'bash')
  const ptyCwd = cwd || os.homedir()

  try {
    const ptyProcess = pty.spawn(shellPath, [], {
      name: 'xterm-color',
      cols: 120,
      rows: 30,
      cwd: ptyCwd,
      env: process.env
    })

    ptyProcesses.set(win.id, ptyProcess)

    ptyProcess.onData((data) => {
      // 只有当前窗口的活跃 PTY 仍是本进程时才发送数据，避免旧 PTY 的数据干扰新终端
      if (ptyProcesses.get(win.id) === ptyProcess && !win.isDestroyed()) {
        win.webContents.send('pty-data', { data, pid: ptyProcess.pid })
      }
    })

    ptyProcess.onExit(({ exitCode, signal }) => {
      // 只有当前窗口的活跃 PTY 仍是本进程时才通知 renderer 并清理，
      // 防止旧 PTY 被替换后的退出事件误杀新终端
      if (ptyProcesses.get(win.id) === ptyProcess) {
        if (!win.isDestroyed()) {
          win.webContents.send('pty-exit', { exitCode, signal, pid: ptyProcess.pid })
        }
        ptyProcesses.delete(win.id)
      }
    })

    return { success: true, pid: ptyProcess.pid }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('pty-write', async (event, data) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return { error: 'No window found' }

  const ptyProcess = ptyProcesses.get(win.id)
  if (!ptyProcess) return { error: 'No active terminal' }

  ptyProcess.write(data)
  return { success: true }
})

ipcMain.handle('pty-resize', async (event, { cols, rows }) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return { error: 'No window found' }

  const ptyProcess = ptyProcesses.get(win.id)
  if (!ptyProcess) return { error: 'No active terminal' }

  ptyProcess.resize(cols, rows)
  return { success: true }
})

ipcMain.handle('pty-kill', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return { error: 'No window found' }

  const ptyProcess = ptyProcesses.get(win.id)
  if (ptyProcess) {
    ptyProcess.kill()
    ptyProcesses.delete(win.id)
  }
  return { success: true }
})

// ===================== Permission Mode =====================

ipcMain.handle('get-permission-mode', async () => {
  try {
    const settingsPath = path.join(CLAUDE_DIR, 'settings.json')
    if (!fs.existsSync(settingsPath)) return { mode: 'default' }
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    return { mode: settings.permissions?.defaultMode || 'default' }
  } catch (err) {
    return { mode: 'default' }
  }
})

ipcMain.handle('set-permission-mode', async (event, { mode }) => {
  try {
    const settingsPath = path.join(CLAUDE_DIR, 'settings.json')
    let settings = {}
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    }
    if (!settings.permissions) settings.permissions = {}
    settings.permissions.defaultMode = mode
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8')
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
})

// ===================== Existing IPC =====================

ipcMain.handle('get-settings', async () => {
  try {
    const globalPath = path.join(CLAUDE_DIR, 'settings.json')
    const localPath = path.join(CLAUDE_DIR, 'settings.local.json')
    const projectGlobal = path.join(process.cwd(), '.claude', 'settings.json')
    const projectLocal = path.join(process.cwd(), '.claude', 'settings.local.json')

    const readJson = (p) => {
      if (!fs.existsSync(p)) return null
      try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null }
    }

    return {
      global: readJson(globalPath),
      globalLocal: readJson(localPath),
      project: readJson(projectGlobal),
      projectLocal: readJson(projectLocal),
      paths: { globalPath, localPath, projectGlobal, projectLocal }
    }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('save-settings', async (event, { scope, data }) => {
  try {
    let targetPath
    if (scope === 'global') targetPath = path.join(CLAUDE_DIR, 'settings.json')
    else if (scope === 'globalLocal') targetPath = path.join(CLAUDE_DIR, 'settings.local.json')
    else if (scope === 'project') targetPath = path.join(process.cwd(), '.claude', 'settings.json')
    else if (scope === 'projectLocal') targetPath = path.join(process.cwd(), '.claude', 'settings.local.json')
    else return { error: 'Unknown scope' }

    const dir = path.dirname(targetPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(targetPath, JSON.stringify(data, null, 2), 'utf8')
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('get-skills', async (event, { cwd } = {}) => {
  try {
    const userSkillsDir = path.join(CLAUDE_DIR, 'skills')
    const userDisabledDir = path.join(CLAUDE_DIR, 'skills-disabled')
    const projectDir = cwd || process.cwd()
    const projectSkillsDir = path.join(projectDir, '.claude', 'skills')
    const projectDisabledDir = path.join(projectDir, '.claude', 'skills-disabled')

    const scanDir = (dir, disabledDir) => {
      const enabled = []
      const disabled = []

      if (fs.existsSync(dir)) {
        fs.readdirSync(dir, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .forEach(d => {
            const skillPath = path.join(dir, d.name)
            const files = fs.readdirSync(skillPath)
            const mdFile = files.find(f => f.endsWith('.md'))
            let description = ''
            if (mdFile) {
              const content = fs.readFileSync(path.join(skillPath, mdFile), 'utf8')
              const match = content.match(/^---\s*\n[\s\S]*?name:\s*(.+?)\n[\s\S]*?description:\s*(.+?)\n/m)
              if (match) description = match[2]
            }
            enabled.push({ name: d.name, path: skillPath, description })
          })
      }

      if (fs.existsSync(disabledDir)) {
        fs.readdirSync(disabledDir, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .forEach(d => {
            disabled.push({ name: d.name, path: path.join(disabledDir, d.name), description: '' })
          })
      }

      return { enabled, disabled }
    }

    return {
      user: scanDir(userSkillsDir, userDisabledDir),
      project: scanDir(projectSkillsDir, projectDisabledDir)
    }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('toggle-skill', async (event, { scope, name, enable, cwd }) => {
  try {
    const baseDir = scope === 'user' ? CLAUDE_DIR : path.join(cwd || process.cwd(), '.claude')
    const srcDir = enable ? path.join(baseDir, 'skills-disabled') : path.join(baseDir, 'skills')
    const destDir = enable ? path.join(baseDir, 'skills') : path.join(baseDir, 'skills-disabled')

    const srcPath = path.join(srcDir, name)
    const destPath = path.join(destDir, name)

    if (!fs.existsSync(srcPath)) return { error: 'Skill not found in source directory' }
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })

    fs.renameSync(srcPath, destPath)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('get-skill-content', async (event, { skillPath }) => {
  try {
    if (!skillPath || !fs.existsSync(skillPath)) return { content: '' }
    const files = fs.readdirSync(skillPath)
    const mdFile = files.find(f => f.endsWith('.md'))
    if (!mdFile) return { content: '' }
    let content = fs.readFileSync(path.join(skillPath, mdFile), 'utf8')
    // Strip YAML frontmatter if present
    content = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '').trim()
    return { content }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('get-mcp-servers', async (event, { cwd } = {}) => {
  try {
    const projectMcpPath = cwd ? path.join(cwd, '.mcp.json') : null
    const globalMcpPath = path.join(CLAUDE_DIR, 'mcp.json')
    const settingsPath = path.join(CLAUDE_DIR, 'settings.json')

    let mcpJson = null
    let source = 'none'

    if (projectMcpPath && fs.existsSync(projectMcpPath)) {
      mcpJson = JSON.parse(fs.readFileSync(projectMcpPath, 'utf8'))
      source = 'project'
    } else if (fs.existsSync(globalMcpPath)) {
      mcpJson = JSON.parse(fs.readFileSync(globalMcpPath, 'utf8'))
      source = 'global'
    }

    let enabledServers = []
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
      enabledServers = settings.enabledMcpjsonServers || []
    }

    return { mcpJson, enabledServers, source, paths: { project: projectMcpPath, global: globalMcpPath } }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('get-builtin-mcp-server', async () => {
  try {
    const serverPath = path.join(__dirname, '..', 'mcp-servers', 'desktop-control', 'index.js')
    const exists = fs.existsSync(serverPath)
    return { path: serverPath, exists }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('save-mcp-config', async (event, { scope, data, cwd }) => {
  try {
    let targetPath
    if (scope === 'project' && cwd) {
      targetPath = path.join(cwd, '.mcp.json')
    } else {
      targetPath = path.join(CLAUDE_DIR, 'mcp.json')
    }

    const dir = path.dirname(targetPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(targetPath, JSON.stringify(data, null, 2), 'utf8')
    return { success: true, path: targetPath }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('toggle-mcp-server', async (event, { name, enable }) => {
  try {
    const settingsPath = path.join(CLAUDE_DIR, 'settings.json')
    let settings = {}
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    }
    if (!settings.enabledMcpjsonServers) settings.enabledMcpjsonServers = []

    if (enable) {
      if (!settings.enabledMcpjsonServers.includes(name)) {
        settings.enabledMcpjsonServers.push(name)
      }
    } else {
      settings.enabledMcpjsonServers = settings.enabledMcpjsonServers.filter(s => s !== name)
    }

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8')
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
})

const ALIASES_PATH = path.join(CLAUDE_DIR, 'project-aliases.json')
const SESSIONS_PATH = path.join(CLAUDE_DIR, 'ccm-sessions.json')
const PROJECT_ORDER_PATH = path.join(CLAUDE_DIR, 'ccm-project-order.json')

function getAliases() {
  try {
    if (!fs.existsSync(ALIASES_PATH)) return {}
    return JSON.parse(fs.readFileSync(ALIASES_PATH, 'utf8'))
  } catch {
    return {}
  }
}

function getProjectOrder() {
  try {
    if (!fs.existsSync(PROJECT_ORDER_PATH)) return []
    return JSON.parse(fs.readFileSync(PROJECT_ORDER_PATH, 'utf8'))
  } catch {
    return []
  }
}

function saveProjectOrder(order) {
  try {
    fs.writeFileSync(PROJECT_ORDER_PATH, JSON.stringify(order, null, 2), 'utf8')
    return true
  } catch {
    return false
  }
}

function saveAliases(aliases) {
  try {
    fs.writeFileSync(ALIASES_PATH, JSON.stringify(aliases, null, 2), 'utf8')
    return true
  } catch {
    return false
  }
}

function getSessions() {
  try {
    if (!fs.existsSync(SESSIONS_PATH)) return []
    return JSON.parse(fs.readFileSync(SESSIONS_PATH, 'utf8'))
  } catch {
    return []
  }
}

function saveSessions(sessions) {
  try {
    fs.writeFileSync(SESSIONS_PATH, JSON.stringify(sessions, null, 2), 'utf8')
    return true
  } catch {
    return false
  }
}

ipcMain.handle('get-transcripts', async () => {
  try {
    const projectsDir = path.join(CLAUDE_DIR, 'projects')
    const aliases = getAliases()
    const sessions = getSessions()

    let projects = []

    if (fs.existsSync(projectsDir)) {
      const scanned = fs.readdirSync(projectsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => {
          const projectPath = path.join(projectsDir, d.name)
          const files = fs.readdirSync(projectPath)
            .filter(f => f.endsWith('.jsonl'))
            .map(f => {
              const stat = fs.statSync(path.join(projectPath, f))
              return { name: f, path: path.join(projectPath, f), size: stat.size, mtime: stat.mtime }
            })
            .sort((a, b) => b.mtime - a.mtime)

          let preview = ''
          let cwd = null
          if (files.length > 0) {
            try {
              const content = fs.readFileSync(files[0].path, 'utf8')
              const lines = content.split('\n').filter(Boolean)

              for (let i = 0; i < Math.min(lines.length, 30); i++) {
                try {
                  const msg = JSON.parse(lines[i])
                  if (msg.cwd) { cwd = msg.cwd; break }
                  if (msg.workspace) { cwd = msg.workspace; break }
                  const text = msg.message?.content || msg.content || ''
                  if (typeof text === 'string') {
                    const match = text.match(/(?:cwd|working directory|project path)[\s:]+([^\n]+)/i)
                    if (match) { cwd = match[1].trim(); break }
                  }
                } catch { }
              }

              const lastLine = lines[lines.length - 1]
              if (lastLine) {
                const msg = JSON.parse(lastLine)
                preview = msg.message?.content || msg.content || ''
                if (typeof preview === 'string' && preview.length > 80) preview = preview.slice(0, 80) + '...'
              }
            } catch { }
          }

          return {
            name: d.name,
            displayName: aliases[d.name] || '',
            path: projectPath,
            files,
            preview,
            lastTime: files[0]?.mtime || null,
            cwd
          }
        })
      projects = scanned
    }

    // 合并应用内创建的会话（新建对话和分支对话）
    const projectNames = new Set(projects.map(p => p.name))
    const projectCwdSet = new Set(projects.map(p => p.cwd).filter(Boolean))
    for (const session of sessions) {
      if (!session.cwd) continue
      // 使用 session.id 作为唯一 name，避免冲突
      if (projectNames.has(session.id)) continue
      // 非分支会话如果 cwd 已存在于扫描项目，则跳过（避免重复显示同一项目）
      if (!session.displayName && projectCwdSet.has(session.cwd)) continue
      projectNames.add(session.id)
      projects.push({
        name: session.id,
        displayName: session.displayName || aliases[session.name] || session.name,
        path: session.cwd,
        files: [],
        preview: '',
        lastTime: session.lastAccessedAt ? new Date(session.lastAccessedAt) : (session.createdAt ? new Date(session.createdAt) : null),
        cwd: session.cwd,
        isSession: true,
        isCasual: !!session.isCasual
      })
    }

    projects.sort((a, b) => {
      const ta = a.lastTime ? new Date(a.lastTime).getTime() : 0
      const tb = b.lastTime ? new Date(b.lastTime).getTime() : 0
      return tb - ta
    })

    return { projects }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('get-project-order', async () => {
  try {
    const order = getProjectOrder()
    return { order }
  } catch (err) {
    return { order: [] }
  }
})

ipcMain.handle('save-project-order', async (event, { order }) => {
  try {
    saveProjectOrder(order)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('save-project-alias', async (event, { projectName, displayName }) => {
  try {
    const aliases = getAliases()
    if (displayName && displayName.trim()) {
      aliases[projectName] = displayName.trim()
    } else {
      delete aliases[projectName]
    }
    saveAliases(aliases)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('save-session', async (event, { cwd, displayName, id: providedId, isCasual }) => {
  try {
    if (!cwd) return { error: 'No cwd provided' }
    const sessions = getSessions()
    const name = path.basename(cwd)
    const now = new Date().toISOString()
    const id = providedId || `${name}-${Date.now()}`

    if (displayName) {
      // Branch/fork: always create a new session entry
      sessions.unshift({ id, name, displayName, cwd, createdAt: now, lastAccessedAt: now, isCasual: !!isCasual })
    } else {
      const existingIndex = sessions.findIndex(s => s.cwd === cwd && !s.displayName)
      if (existingIndex >= 0) {
        sessions[existingIndex].lastAccessedAt = now
        sessions[existingIndex].name = name
        if (isCasual !== undefined) sessions[existingIndex].isCasual = !!isCasual
        const [existing] = sessions.splice(existingIndex, 1)
        sessions.unshift(existing)
      } else {
        sessions.unshift({ id, name, cwd, createdAt: now, lastAccessedAt: now, isCasual: !!isCasual })
      }
    }

    if (sessions.length > 50) {
      sessions.length = 50
    }

    saveSessions(sessions)
    return { success: true, id }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('get-transcript-content', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) return { error: 'File not found' }
    const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean)
    const messages = lines.slice(-200).map(line => {
      try { return JSON.parse(line) } catch { return null }
    }).filter(Boolean)
    return { messages }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('select-directory', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: '选择项目目录'
    })
    if (result.canceled || result.filePaths.length === 0) return { canceled: true }
    return { path: result.filePaths[0] }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('get-env-info', async () => {
  return {
    platform: process.platform,
    homedir: os.homedir(),
    claudeDir: CLAUDE_DIR
  }
})

// ===================== Memory System =====================

ipcMain.handle('get-project-memory', async (event, cwd) => {
  try {
    if (!cwd) return { content: '' }
    const memoryPath = path.join(cwd, '.claude', 'memory.md')
    if (!fs.existsSync(memoryPath)) return { content: '' }
    const content = fs.readFileSync(memoryPath, 'utf8')
    return { content }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('save-project-memory', async (event, { cwd, content }) => {
  try {
    if (!cwd) return { error: 'No cwd provided' }
    const memoryPath = path.join(cwd, '.claude', 'memory.md')
    const dir = path.dirname(memoryPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(memoryPath, content, 'utf8')

    // Update CLAUDE.md
    const claudeMdPath = path.join(cwd, 'CLAUDE.md')
    if (fs.existsSync(claudeMdPath)) {
      let claudeMd = fs.readFileSync(claudeMdPath, 'utf8')
      const memorySection = `\n\n<!-- DYNAMIC_MEMORY_START -->\n# 对话记忆\n\n${content}\n<!-- DYNAMIC_MEMORY_END -->`
      if (claudeMd.includes('<!-- DYNAMIC_MEMORY_START -->')) {
        claudeMd = claudeMd.replace(/<!-- DYNAMIC_MEMORY_START -->[\s\S]*?<!-- DYNAMIC_MEMORY_END -->/, memorySection)
      } else {
        claudeMd += memorySection
      }
      fs.writeFileSync(claudeMdPath, claudeMd, 'utf8')
    }

    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('generate-memory', async (event, { cwd, projectName }) => {
  try {
    if (!cwd) return { content: '' }

    // Find the project in ~/.claude/projects/ matching cwd
    const projectsDir = path.join(CLAUDE_DIR, 'projects')
    let targetJsonl = null

    if (fs.existsSync(projectsDir)) {
      const dirs = fs.readdirSync(projectsDir, { withFileTypes: true }).filter(d => d.isDirectory())
      for (const d of dirs) {
        const projectPath = path.join(projectsDir, d.name)
        const files = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'))
        if (files.length === 0) continue

        // Check if cwd matches
        let foundCwd = null
        try {
          const content = fs.readFileSync(path.join(projectPath, files[0]), 'utf8')
          const lines = content.split('\n').filter(Boolean)
          for (let i = 0; i < Math.min(lines.length, 30); i++) {
            try {
              const msg = JSON.parse(lines[i])
              if (msg.cwd) { foundCwd = msg.cwd; break }
              if (msg.workspace) { foundCwd = msg.workspace; break }
            } catch { }
          }
        } catch { }

        if (foundCwd === cwd) {
          targetJsonl = path.join(projectPath, files.sort((a, b) => {
            const sa = fs.statSync(path.join(projectPath, a))
            const sb = fs.statSync(path.join(projectPath, b))
            return sb.mtime - sa.mtime
          })[0])
          break
        }
      }
    }

    // Fallback: try to find by project name or recent file
    if (!targetJsonl && projectName) {
      const fallbackPath = path.join(projectsDir, projectName)
      if (fs.existsSync(fallbackPath)) {
        const files = fs.readdirSync(fallbackPath).filter(f => f.endsWith('.jsonl'))
        if (files.length > 0) {
          targetJsonl = path.join(fallbackPath, files.sort((a, b) => {
            const sa = fs.statSync(path.join(fallbackPath, a))
            const sb = fs.statSync(path.join(fallbackPath, b))
            return sb.mtime - sa.mtime
          })[0])
        }
      }
    }

    if (!targetJsonl || !fs.existsSync(targetJsonl)) {
      return { content: '# 对话记忆\n\n暂无对话记录。' }
    }

    // Read all messages
    const content = fs.readFileSync(targetJsonl, 'utf8')
    const lines = content.split('\n').filter(Boolean)
    const messages = lines.map(line => {
      try { return JSON.parse(line) } catch { return null }
    }).filter(Boolean)

    // Generate summary
    const userMessages = messages.filter(m => m.type === 'user')
    const assistantMessages = messages.filter(m => m.type === 'assistant')

    let memory = `# 对话记忆\n\n`
    memory += `**生成时间**: ${new Date().toLocaleString()}\n\n`

    // Extract preferences from user messages
    const preferences = extractPreferences(userMessages)
    if (preferences.length > 0) {
      memory += `## 用户偏好与性格\n\n`
      preferences.forEach(p => {
        memory += `- ${p}\n`
      })
      memory += `\n`
    }

    // Project progress
    const progress = extractProgress(messages)
    if (progress.length > 0) {
      memory += `## 项目进度\n\n`
      progress.forEach(p => {
        memory += `- ${p}\n`
      })
      memory += `\n`
    }

    // Decisions
    const decisions = extractDecisions(messages)
    if (decisions.length > 0) {
      memory += `## 重要决策\n\n`
      decisions.forEach(d => {
        memory += `- ${d}\n`
      })
      memory += `\n`
    }

    // Full conversation summary (last 50 exchanges)
    memory += `## 完整对话摘要\n\n`
    const recentMessages = messages.slice(-100)
    recentMessages.forEach(m => {
      const role = m.type === 'user' ? '**用户**' : '**Claude**'
      const text = typeof m.message?.content === 'string'
        ? m.message.content
        : typeof m.content === 'string'
          ? m.content
          : JSON.stringify(m.message?.content || m.content || '').slice(0, 500)
      if (text && text.trim()) {
        memory += `${role}: ${text.slice(0, 300)}${text.length > 300 ? '...' : ''}\n\n`
      }
    })

    return { content: memory }
  } catch (err) {
    return { error: err.message }
  }
})

function extractPreferences(messages) {
  const prefs = []
  const prefKeywords = ['喜欢', '希望', '想要', '不要', '偏好', '习惯', '风格', '审美', '界面', '颜色', '布局', '字体']
  messages.forEach(m => {
    const text = typeof m.message?.content === 'string' ? m.message.content : typeof m.content === 'string' ? m.content : ''
    if (typeof text === 'string') {
      prefKeywords.forEach(kw => {
        if (text.includes(kw) && text.length < 500) {
          const sentence = text.split(/[。！？\n]/).find(s => s.includes(kw))
          if (sentence && !prefs.includes(sentence.trim())) {
            prefs.push(sentence.trim())
          }
        }
      })
    }
  })
  return prefs.slice(0, 20)
}

function extractProgress(messages) {
  const progress = []
  const progressKeywords = ['完成', '做完', '实现', '添加', '修改', '删除', '更新', '修复', '优化', '重构']
  messages.forEach(m => {
    const text = typeof m.message?.content === 'string' ? m.message.content : typeof m.content === 'string' ? m.content : ''
    if (typeof text === 'string') {
      progressKeywords.forEach(kw => {
        if (text.includes(kw) && text.length < 500) {
          const sentence = text.split(/[。！？\n]/).find(s => s.includes(kw))
          if (sentence && !progress.includes(sentence.trim())) {
            progress.push(sentence.trim())
          }
        }
      })
    }
  })
  return progress.slice(0, 20)
}

function extractDecisions(messages) {
  const decisions = []
  const decisionKeywords = ['决定', '选择', '采用', '使用', '确定', '定为', '定为', '方案']
  messages.forEach(m => {
    const text = typeof m.message?.content === 'string' ? m.message.content : typeof m.content === 'string' ? m.content : ''
    if (typeof text === 'string') {
      decisionKeywords.forEach(kw => {
        if (text.includes(kw) && text.length < 500) {
          const sentence = text.split(/[。！？\n]/).find(s => s.includes(kw))
          if (sentence && !decisions.includes(sentence.trim())) {
            decisions.push(sentence.trim())
          }
        }
      })
    }
  })
  return decisions.slice(0, 20)
}

ipcMain.handle('get-all-memories', async () => {
  try {
    const projectsDir = path.join(CLAUDE_DIR, 'projects')
    if (!fs.existsSync(projectsDir)) return { memories: [] }

    const memories = []
    const dirs = fs.readdirSync(projectsDir, { withFileTypes: true }).filter(d => d.isDirectory())

    for (const d of dirs) {
      const memoryPath = path.join(projectsDir, d.name, '.claude', 'memory.md')
      if (fs.existsSync(memoryPath)) {
        const content = fs.readFileSync(memoryPath, 'utf8')
        const firstLine = content.split('\n')[0] || ''
        memories.push({
          projectName: d.name,
          path: memoryPath,
          preview: firstLine.slice(0, 100),
          hasMemory: content.length > 50
        })
      }
    }

    return { memories }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('load-other-memory', async (event, memoryPath) => {
  try {
    if (!fs.existsSync(memoryPath)) return { content: '' }
    const content = fs.readFileSync(memoryPath, 'utf8')
    return { content }
  } catch (err) {
    return { error: err.message }
  }
})

// ===================== Build & Package =====================

const APP_ROOT = path.join(__dirname, '..')
const RELEASE_DIR = path.join(APP_ROOT, 'release', 'win-unpacked')

function sendBuildOutput(win, data) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('build-output', data)
  }
}

function sendBuildDone(win, success, error) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('build-done', { success, error })
  }
}

ipcMain.handle('build-app', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return { error: 'No window found' }

  // Step 1: npm run build
  sendBuildOutput(win, { step: 'build', status: 'start', message: '开始构建前端...' })

  const runBuild = () => new Promise((resolve, reject) => {
    const proc = spawn('npm', ['run', 'build'], {
      cwd: APP_ROOT,
      shell: true,
      env: { ...process.env, FORCE_COLOR: '0' }
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      const text = data.toString()
      stdout += text
      sendBuildOutput(win, { step: 'build', status: 'running', message: text })
    })

    proc.stderr.on('data', (data) => {
      const text = data.toString()
      stderr += text
      sendBuildOutput(win, { step: 'build', status: 'running', message: text })
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`构建失败 (代码: ${code})\n${stderr || stdout}`))
      }
    })
  })

  // Step 2: npm run pack
  const runPack = () => new Promise((resolve, reject) => {
    sendBuildOutput(win, { step: 'pack', status: 'start', message: '开始打包 Electron 应用...' })

    const proc = spawn('npm', ['run', 'pack'], {
      cwd: APP_ROOT,
      shell: true,
      env: { ...process.env, FORCE_COLOR: '0' }
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      const text = data.toString()
      stdout += text
      sendBuildOutput(win, { step: 'pack', status: 'running', message: text })
    })

    proc.stderr.on('data', (data) => {
      const text = data.toString()
      stderr += text
      sendBuildOutput(win, { step: 'pack', status: 'running', message: text })
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`打包失败 (代码: ${code})\n${stderr || stdout}`))
      }
    })
  })

  try {
    await runBuild()
    sendBuildOutput(win, { step: 'build', status: 'done', message: '前端构建完成 ✓' })
    await runPack()
    sendBuildOutput(win, { step: 'pack', status: 'done', message: '打包完成 ✓' })
    sendBuildDone(win, true)
    return { success: true }
  } catch (err) {
    sendBuildOutput(win, { step: 'error', status: 'failed', message: err.message })
    sendBuildDone(win, false, err.message)
    return { error: err.message }
  }
})

ipcMain.handle('open-release-folder', async () => {
  try {
    await shell.openPath(RELEASE_DIR)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('toggle-fullscreen', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win && !win.isDestroyed()) {
    win.setFullScreen(!win.isFullScreen())
  }
  return { success: true, isFullScreen: win ? win.isFullScreen() : false }
})

ipcMain.handle('toggle-devtools', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win && !win.isDestroyed()) {
    if (win.webContents.isDevToolsOpened()) {
      win.webContents.closeDevTools()
    } else {
      win.webContents.openDevTools()
    }
  }
  return { success: true }
})

ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
})

function sendUpdateEvent(channel, data) {
  const wins = BrowserWindow.getAllWindows()
  wins.forEach(win => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data)
    }
  })
}

autoUpdater.on('checking-for-update', () => {
  sendUpdateEvent('update-checking')
})

autoUpdater.on('update-available', (info) => {
  sendUpdateEvent('update-available', { version: info.version, releaseNotes: info.releaseNotes })
})

autoUpdater.on('update-not-available', () => {
  sendUpdateEvent('update-not-available')
})

autoUpdater.on('download-progress', (progressObj) => {
  sendUpdateEvent('update-progress', {
    percent: Math.round(progressObj.percent),
    transferred: progressObj.transferred,
    total: progressObj.total
  })
})

autoUpdater.on('update-downloaded', (info) => {
  sendUpdateEvent('update-downloaded', { version: info.version })
})

autoUpdater.on('error', (err) => {
  sendUpdateEvent('update-error', { message: err.message })
})

ipcMain.handle('check-for-update', async () => {
  try {
    const result = await autoUpdater.checkForUpdates()
    return { success: true, updateInfo: result?.updateInfo }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('quit-and-install', async () => {
  isQuitting = true
  autoUpdater.quitAndInstall()
  return { success: true }
})

// ===================== Window Controls =====================

ipcMain.handle('window-minimize', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize()
  }
  return { success: true }
})

ipcMain.handle('window-maximize', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
  return { success: true, isMaximized: mainWindow ? mainWindow.isMaximized() : false }
})

ipcMain.handle('window-close', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close()
  }
  return { success: true }
})

ipcMain.handle('is-window-maximized', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return { isMaximized: mainWindow.isMaximized() }
  }
  return { isMaximized: false }
})

// Check for updates shortly after app launch (not immediately, to avoid startup lag)
app.whenReady().then(() => {
  setTimeout(() => {
    // Only auto-check in packaged app, not dev mode
    if (app.isPackaged) {
      autoUpdater.checkForUpdates().catch(() => {})
    }
  }, 5000)
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
