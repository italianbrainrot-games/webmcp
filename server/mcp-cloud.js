import express from 'express';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { WebSocketServer } from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import apiApp from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

// 挂载 API 路由
app.use(apiApp);

// Session 管理表：sessionId -> { ws, tools, pendingCalls, mcpServer, sseTransport }
const sessions = new Map();

function bindMcpServerHandlers(mcpServer, session) {
  // 1. 处理手机端发来的获取工具列表请求
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: Array.from(session.tools.values()).map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) };
  });

  // 2. 处理手机端发来的调用工具请求
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!session.ws || session.ws.readyState !== 1) {
      throw new Error("🚨 无法调用：电脑端网页未连接，请刷新电脑网页。");
    }
    const toolName = request.params.name;
    if (!session.tools.has(toolName)) {
      throw new Error(`🚨 工具 ${toolName} 未在电脑端注册`);
    }

    const callId = String(++session.callIdCounter);
    const promise = new Promise((resolve, reject) => {
      session.pendingCalls.set(callId, { resolve, reject });
      setTimeout(() => {
        if (session.pendingCalls.has(callId)) {
          session.pendingCalls.delete(callId);
          reject(new Error(`调用电脑端工具 ${toolName} 超时`));
        }
      }, 30000);
    });

    // 将调用指令转发给电脑端网页
    session.ws.send(JSON.stringify({ type: 'call', id: callId, name: toolName, args: request.params.arguments }));
    try { return await promise; } catch (err) { return { content: [{ type: "text", text: `❌ 失败: ${err.message}` }], isError: true }; }
  });
}

function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    const mcpServer = new Server({ name: "vue-webmcp-cloud", version: "1.0.0" }, { capabilities: { tools: { listChanged: true } } });
    
    const session = {
      ws: null,
      tools: new Map(),
      pendingCalls: new Map(),
      callIdCounter: 0,
      mcpServer: mcpServer,
      sseTransport: null
    };

    bindMcpServerHandlers(mcpServer, session);

    sessions.set(sessionId, session);
  }
  return sessions.get(sessionId);
}

// ================= HTTP / SSE (给手机端使用) =================
// 手机端连接 SSE 接口获取指令下发通道
app.get('/sse', async (req, res) => {
  const sessionId = req.query.sessionId;
  if (!sessionId) return res.status(400).send('Missing sessionId');
  
  const session = getOrCreateSession(sessionId);

  // 如果已经存在 transport，说明是手机端刷新或重连，我们需要重新创建一个 mcpServer
  if (session.sseTransport) {
    try { await session.mcpServer.close(); } catch (e) {}
    
    // 重新创建 mcpServer
    const mcpServer = new Server({ name: "vue-webmcp-cloud", version: "1.0.0" }, { capabilities: { tools: { listChanged: true } } });
    
    // 重新绑定 handlers
    bindMcpServerHandlers(mcpServer, session);

    session.mcpServer = mcpServer;
  }

  try {
    session.sseTransport = new SSEServerTransport("/messages?clientSessionId=" + sessionId, res);
    await session.mcpServer.connect(session.sseTransport);
    console.log(`📱 [手机端] 已连接 Session: ${sessionId}`);
  } catch (err) {
    console.error("SSE 连接失败:", err);
    res.status(500).send("SSE Connection Failed");
  }
});

// 手机端通过 POST 发送 MCP 指令
app.post('/messages', async (req, res) => {
  const sessionId = req.query.clientSessionId;
  const session = sessions.get(sessionId);
  if (!session || !session.sseTransport) return res.status(404).send('Session not found');
  await session.sseTransport.handlePostMessage(req, res, req.body);
});

// 托管手机端 HTML 静态页面
app.use(express.static(path.join(__dirname, 'public')));

// 托管前端打包后的静态文件 (dist)
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// 处理前端 Vue Router 的 History 模式 (作为最后的 fallback)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/sse')) {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    next();
  }
});

// 使用环境变量中的 PORT，如果不存在则使用 3002 (适合 Render 等平台)
const HTTP_PORT = process.env.PORT || 3002;
const server = app.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`🚀 云端中转服务及前后端已启动: http://0.0.0.0:${HTTP_PORT}`);
});

// ================= WebSocket (给电脑端网页使用) =================
const wss = new WebSocketServer({ server });
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost:${HTTP_PORT}`);
  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId) { ws.close(); return; }

  console.log(`💻 [电脑端] 已连接 Session: ${sessionId}`);
  const session = getOrCreateSession(sessionId);
  session.ws = ws;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'register') {
        session.tools.set(data.tool.name, data.tool);
        session.mcpServer.sendToolListChanged().catch(() => {});
      } else if (data.type === 'unregister') {
        session.tools.delete(data.name);
        session.mcpServer.sendToolListChanged().catch(() => {});
      } else if (data.type === 'result') {
        if (session.pendingCalls.has(data.id)) {
          const { resolve, reject } = session.pendingCalls.get(data.id);
          if (data.error) reject(new Error(data.error));
          else resolve(data.result);
          session.pendingCalls.delete(data.id);
        }
      }
    } catch (e) { console.error(e); }
  });

  ws.on('close', () => { 
    console.log(`💻 [电脑端] 已断开 Session: ${sessionId}`);
    session.ws = null; 
  });
});