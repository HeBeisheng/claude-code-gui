import React, { useEffect, useState } from 'react'

function McpPanel() {
  const [mcpData, setMcpData] = useState(null)

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getMcpServers().then(setMcpData)
    }
  }, [])

  const servers = mcpData?.mcpJson?.mcpServers || {}

  return (
    <div>
      <h1 className="panel-title">MCP 服务器</h1>
      <p className="panel-subtitle">管理 Model Context Protocol 外部工具连接</p>

      <div className="card">
        <div className="card-title">已配置的服务器 <span style={{ color: '#666', fontSize: '13px', fontWeight: 400 }}>({Object.keys(servers).length})</span></div>
        {Object.keys(servers).length === 0 ? (
          <div className="card-empty">未在项目根目录找到 .mcp.json 配置文件</div>
        ) : (
          <div className="grid">
            {Object.entries(servers).map(([name, config]) => (
              <div key={name} className="item-card">
                <div className="item-name">{name}</div>
                <div className="item-desc">{config.description || '暂无描述'}</div>
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {config.command && (
                    <div style={{ fontSize: '12px', color: '#888' }}>
                      命令: <code>{config.command}</code>
                    </div>
                  )}
                  {config.url && (
                    <div style={{ fontSize: '12px', color: '#888' }}>
                      地址: <code>{config.url}</code>
                    </div>
                  )}
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    工具数量: {config.tools?.length || '未知'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">配置文件内容</div>
        <pre className="json-view">{mcpData?.mcpJson ? JSON.stringify(mcpData.mcpJson, null, 2) : '未找到 .mcp.json'}</pre>
      </div>

      <div className="card">
        <div className="card-title">关于 MCP</div>
        <p style={{ fontSize: '14px', color: '#888', lineHeight: '1.7' }}>
          MCP（Model Context Protocol）是 Claude Code 与外部工具通信的标准协议。
          通过配置 .mcp.json 文件，你可以让 Claude 调用文件系统、数据库、API 等外部能力。
        </p>
        <pre className="json-view" style={{ marginTop: '16px' }}>{JSON.stringify({
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
      "description": "文件系统访问"
    }
  }
}, null, 2)}</pre>
      </div>
    </div>
  )
}

export default McpPanel
