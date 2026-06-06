#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js')
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js')
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js')
const { exec } = require('child_process')
const path = require('path')
const os = require('os')
const fs = require('fs')

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    const cmd = `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${script.replace(/"/g, '\\"')}"`
    exec(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stdout) return reject(error)
      resolve(stdout.trim())
    })
  })
}

const server = new Server(
  { name: 'desktop-control', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_screen_size',
        description: '获取主屏幕分辨率',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'screen_capture',
        description: '截取当前屏幕并返回 base64 PNG 图片',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'mouse_move',
        description: '移动鼠标到指定坐标',
        inputSchema: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X 坐标' },
            y: { type: 'number', description: 'Y 坐标' }
          },
          required: ['x', 'y']
        }
      },
      {
        name: 'mouse_click',
        description: '在指定坐标点击鼠标（不指定则在当前位置点击）',
        inputSchema: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X 坐标（可选）' },
            y: { type: 'number', description: 'Y 坐标（可选）' },
            button: { type: 'string', enum: ['left', 'right', 'middle'], description: '鼠标按键' },
            double: { type: 'boolean', description: '是否双击' }
          }
        }
      },
      {
        name: 'keyboard_type',
        description: '在当前光标处输入文本',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: '要输入的文本' }
          },
          required: ['text']
        }
      },
      {
        name: 'keyboard_press',
        description: '按下特殊键（如 Enter、Tab、Esc 等）',
        inputSchema: {
          type: 'object',
          properties: {
            key: { type: 'string', enum: ['enter', 'tab', 'esc', 'space', 'backspace', 'delete', 'up', 'down', 'left', 'right', 'home', 'end', 'pageup', 'pagedown'], description: '按键名称' }
          },
          required: ['key']
        }
      }
    ]
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case 'get_screen_size': {
        const script = `
Add-Type -AssemblyName System.Windows.Forms
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
Write-Output "$($bounds.Width) $($bounds.Height)"
`
        const out = await runPowerShell(script)
        const [w, h] = out.split(' ').map(Number)
        return { content: [{ type: 'text', text: `屏幕分辨率: ${w}x${h}` }] }
      }

      case 'screen_capture': {
        const tmpFile = path.join(os.tmpdir(), `ccm-screenshot-${Date.now()}.png`)
        const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bitmap.Save('${tmpFile.replace(/\\/g, '\\\\')}')
$bitmap.Dispose()
$graphics.Dispose()
Write-Output "done"
`
        await runPowerShell(script)
        const data = fs.readFileSync(tmpFile)
        const base64 = data.toString('base64')
        fs.unlinkSync(tmpFile)
        return {
          content: [
            { type: 'text', text: `屏幕截图已捕获 (${Math.round(data.length / 1024)} KB)` },
            { type: 'image', data: base64, mimeType: 'image/png' }
          ]
        }
      }

      case 'mouse_move': {
        const script = `
Add-Type -MemberDefinition '[DllImport("user32.dll")]public static extern bool SetCursorPos(int x, int y);' -Name User32 -Namespace WinAPI
[WinAPI.User32]::SetCursorPos(${args.x}, ${args.y})
Write-Output "done"
`
        await runPowerShell(script)
        return { content: [{ type: 'text', text: `鼠标已移动到 (${args.x}, ${args.y})` }] }
      }

      case 'mouse_click': {
        let script = ''
        if (args.x !== undefined && args.y !== undefined) {
          script += `
Add-Type -MemberDefinition '[DllImport("user32.dll")]public static extern bool SetCursorPos(int x, int y);' -Name User32 -Namespace WinAPI
[WinAPI.User32]::SetCursorPos(${args.x}, ${args.y})
`
        }
        const btnMap = { left: '0x0002,0x0004', right: '0x0008,0x0010', middle: '0x0020,0x0040' }
        const [down, up] = (btnMap[args.button || 'left'] || btnMap.left).split(',')
        const times = args.double ? 2 : 1
        for (let i = 0; i < times; i++) {
          script += `
Add-Type -MemberDefinition '[DllImport("user32.dll")]public static extern void mouse_event(int flags, int dx, int dy, int data, int extra);' -Name User32Mouse -Namespace WinAPI
[WinAPI.User32Mouse]::mouse_event(${down}, 0, 0, 0, 0)
[WinAPI.User32Mouse]::mouse_event(${up}, 0, 0, 0, 0)
Start-Sleep -Milliseconds 50
`
        }
        script += 'Write-Output "done"'
        await runPowerShell(script)
        const desc = `${args.double ? '双击' : '单击'}${args.button || '左'}键`
        const pos = (args.x !== undefined && args.y !== undefined) ? ` 在 (${args.x}, ${args.y})` : ''
        return { content: [{ type: 'text', text: `${desc}${pos}` }] }
      }

      case 'keyboard_type': {
        const text = args.text
          .replace(/"/g, '`"')
          .replace(/\{/g, '{{}')
          .replace(/\}/g, '{}}')
          .replace(/\+/g, '{+}')
          .replace(/\^/g, '{^}')
          .replace(/%/g, '{%}')
          .replace(/~/g, '{~}')
          .replace(/\(/g, '{(}')
          .replace(/\)/g, '{)}')
        const script = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("${text}")
Write-Output "done"
`
        await runPowerShell(script)
        return { content: [{ type: 'text', text: `已输入: ${args.text}` }] }
      }

      case 'keyboard_press': {
        const keyMap = {
          enter: '{ENTER}', tab: '{TAB}', esc: '{ESC}', space: ' ',
          backspace: '{BACKSPACE}', delete: '{DELETE}',
          up: '{UP}', down: '{DOWN}', left: '{LEFT}', right: '{RIGHT}',
          home: '{HOME}', end: '{END}', pageup: '{PGUP}', pagedown: '{PGDN}'
        }
        const key = keyMap[args.key] || args.key
        const script = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("${key}")
Write-Output "done"
`
        await runPowerShell(script)
        return { content: [{ type: 'text', text: `已按下: ${args.key}` }] }
      }

      default:
        return { content: [{ type: 'text', text: '未知工具' }], isError: true }
    }
  } catch (err) {
    return { content: [{ type: 'text', text: `错误: ${err.message}` }], isError: true }
  }
})

const transport = new StdioServerTransport()
server.connect(transport).catch(console.error)
