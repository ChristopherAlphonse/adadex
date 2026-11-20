// Spawned by Claude Code as an MCP server (stdio). It exposes one tool, `adadex_action`, and forwards
// every call over a local socket to the app, which decides through the action host. Node built-ins only.
import net from "node:net";
import readline from "node:readline";

const socket = net.connect(process.argv[2]);
const pending = new Map();
let nextCall = 0;

readline.createInterface({ input: socket }).on("line", (line) => {
  try {
    const reply = JSON.parse(line);
    pending.get(reply.callId)?.(reply);
    pending.delete(reply.callId);
  } catch {
    // A malformed line from the app is dropped. The waiting call times out on the agent's side.
  }
});

const TOOL = {
  name: "adadex_action",
  description:
    "Run a workflow action through the app, such as job.advance or job.run_gate. The app decides whether it runs, " +
    "needs approval, or needs a person to click. The result is JSON with a status: ok, denied, error, or needs-human-click. " +
    "If the status is needs-human-click, tell the user and stop: you cannot do that action.",
  inputSchema: {
    type: "object",
    properties: {
      actionId: { type: "string", description: "The action id, for example job.advance" },
      input: { type: "object", description: "The action's input, for example {id, to}" },
    },
    required: ["actionId"],
  },
};

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const ok = (id, result) => send({ jsonrpc: "2.0", id, result });
const fail = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });

const callApp = (actionId, input) =>
  new Promise((resolve) => {
    const callId = `c${++nextCall}`;
    pending.set(callId, resolve);
    socket.write(`${JSON.stringify({ callId, actionId, input })}\n`);
  });

const handle = async (msg) => {
  if (msg.method === "initialize") {
    return ok(msg.id, {
      protocolVersion: msg.params?.protocolVersion ?? "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "adadex", version: "0.0.0" },
    });
  }
  if (msg.method === "tools/list") return ok(msg.id, { tools: [TOOL] });
  if (msg.method === "tools/call") {
    const args = msg.params?.arguments ?? {};
    if (msg.params?.name !== TOOL.name || typeof args.actionId !== "string") {
      return ok(msg.id, { content: [{ type: "text", text: "expected actionId" }], isError: true });
    }
    const reply = await callApp(args.actionId, args.input ?? {});
    return ok(msg.id, {
      content: [{ type: "text", text: reply.text }],
      isError: reply.isError === true,
    });
  }
  if (msg.id !== undefined) return fail(msg.id, -32601, `unknown method ${msg.method}`);
  return undefined;
};

readline.createInterface({ input: process.stdin }).on("line", (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  handle(msg).catch((e) => msg.id !== undefined && fail(msg.id, -32603, String(e?.message ?? e)));
});

socket.on("close", () => process.exit(0));
socket.on("error", () => process.exit(1));
