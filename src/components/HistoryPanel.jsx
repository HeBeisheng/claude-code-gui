import React, { useEffect, useState } from 'react'

function HistoryPanel() {
  const [transcripts, setTranscripts] = useState({ projects: [] })
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileContent, setFileContent] = useState(null)

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getTranscripts().then(setTranscripts)
    }
  }, [])

  const handleSelectFile = async (file) => {
    setSelectedFile(file)
    const content = await window.electronAPI.getTranscriptContent(file.path)
    setFileContent(content)
  }

  const totalFiles = transcripts.projects?.reduce((sum, p) => sum + p.files.length, 0) || 0

  return (
    <div>
      <h1 className="panel-title">对话历史</h1>
      <p className="panel-subtitle">浏览 ~/.claude/projects/ 下的会话记录 ({totalFiles} 个文件)</p>

      <div className="two-col">
        <div>
          {transcripts.projects?.length === 0 ? (
            <div className="card">
              <div className="card-empty">未找到任何对话记录</div>
            </div>
          ) : (
            transcripts.projects?.map(project => (
              <div key={project.name} className="card" style={{ padding: '16px' }}>
                <div className="card-title" style={{ fontSize: '14px', marginBottom: '12px' }}>
                  {project.name}
                </div>
                <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                  {project.files.map(file => (
                    <div
                      key={file.name}
                      onClick={() => handleSelectFile(file)}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        borderRadius: '8px',
                        fontSize: '13px',
                        background: selectedFile?.name === file.name ? '#1a1a1a' : 'transparent',
                        borderLeft: selectedFile?.name === file.name ? '3px solid #d4a574' : '3px solid transparent',
                        transition: 'all 0.15s',
                        marginBottom: '4px'
                      }}
                    >
                      <div style={{ color: '#ccc', fontWeight: 500 }}>{file.name}</div>
                      <div style={{ color: '#555', fontSize: '11px', marginTop: '4px' }}>
                        {(file.size / 1024).toFixed(1)} KB · {new Date(file.mtime).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div>
          {selectedFile ? (
            <div className="card">
              <div className="card-title">{selectedFile.name}</div>
              {fileContent?.messages ? (
                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  {fileContent.messages.map((msg, i) => (
                    <div key={i} className={`message-card ${msg.type === 'user' ? 'message-user' : 'message-assistant'}`}>
                      <div className="message-header">
                        {msg.type === 'user' ? '你' : 'Claude'} · {msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}
                      </div>
                      <div style={{ color: '#ccc', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                        {typeof msg.message?.content === 'string'
                          ? msg.message.content
                          : JSON.stringify(msg.message?.content || msg).slice(0, 500)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card-empty">加载中或无法解析此文件</div>
              )}
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '80px 40px' }}>
              <div style={{ fontSize: '14px', color: '#555', marginBottom: '8px' }}>在左侧选择一个会话文件</div>
              <div style={{ fontSize: '13px', color: '#444' }}>即可在此处查看对话详情</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default HistoryPanel
