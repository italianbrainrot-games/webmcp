import express from 'express';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const app = express();
const mcpServer = new Server({ name: "test", version: "1.0.0" }, { capabilities: {} });
let connected = false;

app.get('/sse', async (req, res) => {
  try {
    const transport = new SSEServerTransport("/messages", res);
    await mcpServer.connect(transport);
    console.log("Connected!");
  } catch (e) {
    console.error("Error connecting:", e.message);
    res.status(500).send(e.message);
  }
});

app.listen(3003, () => console.log('Listening on 3003'));
