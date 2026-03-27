export const sessionId = 'session_' + Math.random().toString(36).substring(2, 9)

export function initWebMCPClient() {

  // 动态获取当前主机的 IP/域名，避免手机扫码后连不上 localhost
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  // 在开发环境下（Vite默认端口），连接3002；生产环境则连接当前端口
  const isDev = import.meta.env.DEV
  const port = isDev ? '3002' : window.location.port
  const host = window.location.hostname + (port ? `:${port}` : '')
  const wsUrl = `${protocol}//${host}?sessionId=${sessionId}`
  
  let ws: WebSocket | null = null
  const registeredTools = new Map<string, any>()
  let isConnected = false

  const connect = () => {
    ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('✅ 已成功连接到本地 WebMCP 服务器:', wsUrl)
      isConnected = true
      // 连接成功后，发送所有已注册的工具给服务器
      for (const tool of registeredTools.values()) {
        sendRegisterTool(tool)
      }
    }

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'call') {
          console.log(`📡 收到 AI 调用工具指令: ${msg.name}`, msg.args)
          const tool = registeredTools.get(msg.name)
          if (tool) {
            try {
              const result = await tool.execute(msg.args)
              console.log(`✅ 工具 ${msg.name} 执行完毕，返回结果:`, result)
              ws?.send(JSON.stringify({ type: 'result', id: msg.id, result }))
            } catch (error: any) {
              console.error(`❌ 工具 ${msg.name} 执行报错:`, error)
              ws?.send(JSON.stringify({ type: 'result', id: msg.id, error: error.message }))
            }
          } else {
            console.warn(`⚠️ 未找到注册的工具: ${msg.name}`)
            ws?.send(JSON.stringify({ type: 'result', id: msg.id, error: `Tool ${msg.name} not found in frontend` }))
          }
        } else if (msg.type === 'ping') {
           ws?.send(JSON.stringify({ type: 'pong' }))
        }
      } catch (err) {
        console.error('WebSocket 消息解析失败:', err)
      }
    }

    ws.onclose = () => {
      console.log('❌ 已断开与 WebMCP 服务器的连接，正在重连...')
      isConnected = false
      setTimeout(connect, 3000) // 3秒后自动重连
    }

    ws.onerror = (error) => {
      console.error('WebSocket 发生错误:', error)
    }
  }

  const sendRegisterTool = (tool: any) => {
    if (ws && isConnected) {
      ws.send(JSON.stringify({
        type: 'register',
        tool: {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }
      }))
    }
  }

  const sendUnregisterTool = (name: string) => {
    if (ws && isConnected) {
      ws.send(JSON.stringify({
        type: 'unregister',
        name
      }))
    }
  }

  // 初始化连接
  connect()

  // 注入 navigator.modelContext 替代浏览器扩展
  ;(navigator as any).modelContext = {
    registerTool: (tool: any) => {
      registeredTools.set(tool.name, tool)
      sendRegisterTool(tool)
    },
    unregisterTool: (name: string) => {
      registeredTools.delete(name)
      sendUnregisterTool(name)
    }
  }

  console.log('🚀 本地 WebMCP 客户端已初始化 (替代浏览器扩展)')
}
