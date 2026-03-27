import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { WebSocketServer } from 'ws';

// 1. 创建 WebSocket Server 监听前端 Vue 的连接
const WS_PORT = 3001;
const wss = new WebSocketServer({ port: WS_PORT });

// 存储当前连接的浏览器页面
let frontendClient = null;
// 存储前端注册上来的工具 Schema
const registeredTools = new Map();

// 处理前端传回来的异步调用结果
const pendingCalls = new Map();
let callIdCounter = 0;

console.error(`🚀 本地 WebMCP 中转服务正在启动... WebSocket 端口: ${WS_PORT}`);

wss.on('connection', (ws) => {
  console.error('✅ 浏览器前端已成功建立 WebSocket 连接');
  frontendClient = ws;
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'register') {
        console.error(`[WS] 前端注册了工具: ${data.tool.name}`);
        registeredTools.set(data.tool.name, data.tool);
        // 通知 AI 客户端工具列表已更新
        server.sendToolListChanged().catch(e => console.error('[MCP] 发送 ToolListChanged 失败:', e));
      } else if (data.type === 'unregister') {
        console.error(`[WS] 前端注销了工具: ${data.name}`);
        registeredTools.delete(data.name);
        server.sendToolListChanged().catch(e => console.error('[MCP] 发送 ToolListChanged 失败:', e));
      } else if (data.type === 'result') {
        // 前端工具执行完毕，返回结果
        if (pendingCalls.has(data.id)) {
          const { resolve, reject } = pendingCalls.get(data.id);
          if (data.error) {
            reject(new Error(data.error));
          } else {
            resolve(data.result);
          }
          pendingCalls.delete(data.id);
        }
      }
    } catch (e) {
      console.error('[WS] 消息解析错误:', e);
    }
  });

  ws.on('close', () => {
    console.error('❌ 浏览器前端已断开 WebSocket 连接');
    frontendClient = null;
    // 连接断开时，也可以选择清空工具
    // registeredTools.clear();
  });
});

// 2. 创建标准 MCP Server
const server = new Server(
  {
    name: "vue-webmcp-bridge",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {
        listChanged: true
      },
    },
  }
);

// 3. 处理 MCP 工具列表请求
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: Array.from(registeredTools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  };
});

// 4. 处理 MCP 工具调用请求
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (!frontendClient || frontendClient.readyState !== 1 /* OPEN */) {
    throw new Error("🚨 无法调用工具：浏览器前端未连接，请先打开或刷新 Vue 页面。");
  }

  const toolName = request.params.name;
  if (!registeredTools.has(toolName)) {
    throw new Error(`🚨 无法调用工具：工具 ${toolName} 不存在或尚未注册。`);
  }

  const callId = String(++callIdCounter);
  const promise = new Promise((resolve, reject) => {
    pendingCalls.set(callId, { resolve, reject });
    
    // 30 秒超时控制
    setTimeout(() => {
      if (pendingCalls.has(callId)) {
        pendingCalls.delete(callId);
        reject(new Error(`调用前端工具 ${toolName} 超时 (30s)。`));
      }
    }, 30000);
  });

  // 通过 WebSocket 告诉前端去执行对应的函数
  frontendClient.send(JSON.stringify({
    type: 'call',
    id: callId,
    name: toolName,
    args: request.params.arguments,
  }));

  try {
    const result = await promise;
    // 前端返回的数据通常长这样: { content: [{ type: 'text', text: '...' }] }
    return result;
  } catch (err) {
    return {
      content: [{ type: "text", text: `❌ 执行失败: ${err.message}` }],
      isError: true,
    };
  }
});

// 5. 启动 stdio 通信 (供 Trae/Claude 连接)
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✅ WebMCP 标准接口已启动 (基于 stdio)，等待 AI 客户端连接...");
}

main().catch(console.error);
