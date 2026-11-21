// Claude Code PreToolUse hook. It asks the running app whether a tool call may go ahead, and blocks the
// call (exit 2) when the answer is no, when the app cannot be reached, or when anything at all goes wrong.
// Node built-ins only.
import net from "node:net";
import readline from "node:readline";

const block = (why) => {
  process.stderr.write(`blocked by the adadex policy: ${why}\n`);
  process.exit(2);
};

const chunks = [];

process.stdin.on("data", (c) => chunks.push(c));

process.stdin.on("end", () => {
  let event;

  try {
    event = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return block("the call could not be read");
  }

  const socket = net.connect(process.argv[2]);

  const give_up = setTimeout(
    () => block("the app did not answer in time"),
    Number(process.argv[3] ?? 600) * 1000,
  );

  socket.on("error", () => block("the app is not reachable"));
  socket.on("close", () => block("the app closed the connection without an answer"));
  readline.createInterface({ input: socket }).on("line", (line) => {
    clearTimeout(give_up);

    try {
      const reply = JSON.parse(line);

      if (reply.allow === true) process.exit(0);
      block(
        Object.prototype.toString.call(reply.reason) === "[object String]"
          ? reply.reason
          : "not allowed",
      );
    } catch {
      block("the answer could not be read");
    }
  });
  socket.write(`${JSON.stringify({ event })}\n`);
});
