const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (payload) => ipcRenderer.invoke('save-settings', payload),

  // Skills
  getSkills: () => ipcRenderer.invoke('get-skills'),
  toggleSkill: (payload) => ipcRenderer.invoke('toggle-skill', payload),

  // MCP
  getMcpServers: () => ipcRenderer.invoke('get-mcp-servers'),

  // Transcripts / History
  getTranscripts: () => ipcRenderer.invoke('get-transcripts'),
  getTranscriptContent: (filePath) => ipcRenderer.invoke('get-transcript-content', filePath),

  // Directory
  selectDirectory: () => ipcRenderer.invoke('select-directory'),

  // Env
  getEnvInfo: () => ipcRenderer.invoke('get-env-info'),

  // PTY Terminal
  ptyCreate: (payload) => ipcRenderer.invoke('pty-create', payload),
  ptyWrite: (data) => ipcRenderer.invoke('pty-write', data),
  ptyResize: (payload) => ipcRenderer.invoke('pty-resize', payload),
  ptyKill: () => ipcRenderer.invoke('pty-kill'),

  // PTY Events
  onPtyData: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('pty-data', handler)
    return () => ipcRenderer.removeListener('pty-data', handler)
  },
  onPtyExit: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('pty-exit', handler)
    return () => ipcRenderer.removeListener('pty-exit', handler)
  },

  // Memory System
  getProjectMemory: (cwd) => ipcRenderer.invoke('get-project-memory', cwd),
  saveProjectMemory: (payload) => ipcRenderer.invoke('save-project-memory', payload),
  generateMemory: (payload) => ipcRenderer.invoke('generate-memory', payload),
  getAllMemories: () => ipcRenderer.invoke('get-all-memories'),
  loadOtherMemory: (memoryPath) => ipcRenderer.invoke('load-other-memory', memoryPath),
  confirmQuit: (payload) => ipcRenderer.invoke('confirm-quit', payload),

  // Quit Event
  onAskSaveMemory: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('ask-save-memory', handler)
    return () => ipcRenderer.removeListener('ask-save-memory', handler)
  }
})
