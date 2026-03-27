import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function run() {
  const transport = new SSEClientTransport(new URL("http://localhost:3002/sse?sessionId=test_session"));
  const mcpClient = new Client({ name: "mobile-remote", version: "1.0.0" }, { capabilities: {} });
  
  console.log("Connecting...");
  await mcpClient.connect(transport);
  console.log("Connected!");
  
  const res = await mcpClient.listTools();
  console.log("Tools:", res.tools.length);
  process.exit(0);
}
run().catch(e => {
  console.error(e);
  process.exit(1);
});
