const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const pty = require('node-pty')

let mainWindow

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
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

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
      if (!win.isDestroyed()) {
        win.webContents.send('pty-data', data)
      }
    })

    ptyProcess.onExit(({ exitCode, signal }) => {
      if (!win.isDestroyed()) {
        win.webContents.send('pty-exit', { exitCode, signal })
      }
      ptyProcesses.delete(win.id)
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

ipcMain.handle('get-skills', async () => {
  try {
    const userSkillsDir = path.join(CLAUDE_DIR, 'skills')
    const userDisabledDir = path.join(CLAUDE_DIR, 'skills-disabled')
    const projectSkillsDir = path.join(process.cwd(), '.claude', 'skills')
    const projectDisabledDir = path.join(process.cwd(), '.claude', 'skills-disabled')

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

ipcMain.handle('toggle-skill', async (event, { scope, name, enable }) => {
  try {
    const baseDir = scope === 'user' ? CLAUDE_DIR : path.join(process.cwd(), '.claude')
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

ipcMain.handle('get-mcp-servers', async () => {
  try {
    const mcpJsonPath = path.join(process.cwd(), '.mcp.json')
    const mcpJson = fs.existsSync(mcpJsonPath) ? JSON.parse(fs.readFileSync(mcpJsonPath, 'utf8')) : null
    return { mcpJson }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('get-transcripts', async () => {
  try {
    const projectsDir = path.join(CLAUDE_DIR, 'projects')
    if (!fs.existsSync(projectsDir)) return { projects: [] }

    const projects = fs.readdirSync(projectsDir, { withFileTypes: true })
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

        // Extract cwd and preview from the most recent file
        let preview = ''
        let cwd = null
        if (files.length > 0) {
          try {
            const content = fs.readFileSync(files[0].path, 'utf8')
            const lines = content.split('\n').filter(Boolean)

            // Try to find cwd from early messages (system info usually at top)
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

        return { name: d.name, path: projectPath, files, preview, lastTime: files[0]?.mtime || null, cwd }
      })
      .sort((a, b) => (b.lastTime || 0) - (a.lastTime || 0))

    return { projects }
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

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
