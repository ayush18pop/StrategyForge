const http = require("http");
const fs = require("fs");
const path = require("path");

const LOG = path.resolve(__dirname, "../packages/pipeline/out.log");
const port = 9876;

function parseLineToEvent(line) {
  if (!line) return null;
  line = line.trim();

  if (line.includes("KeeperHub — listActionSchemas"))
    return { station: "Discovery", type: "start" };
  if (line.includes("schema count"))
    return { station: "Discovery", type: "log", text: "Schemas extracted" };

  if (line.includes("Researcher — LLM Call"))
    return { station: "Researcher", type: "start" };
  if (line.includes("Prompts"))
    return {
      station: "Researcher",
      type: "log",
      text: line.replace("│", "").trim(),
    };
  if (!line.includes("Researcher — LLM Call") && line.startsWith("  │"))
    return {
      station: "Researcher",
      type: "log",
      text: line.replace("│", "").trim(),
    };

  if (line.includes("STEP 4A — Compiler.init"))
    return { station: "Compiler", type: "start", text: "compiler init" };
  if (line.includes("compile") || line.includes("gas"))
    return { station: "Compiler", type: "log", text: line };

  if (line.match(/Candidate [A-Z]/i))
    return { station: "Strategist", type: "candidate", text: line };

  if (line.includes("attestation") || line.match(/0x[0-9a-f]{6,}/i)) {
    // Determine which station based on heuristics
    return {
      station: "Researcher",
      type: "attest",
      hash:
        line.match(/(0x[0-9a-f]{6,})/i)?.[1] ||
        "0x" + Math.random().toString(16).slice(2, 18),
    };
  }

  return { station: "Discovery", type: "log", text: line.slice(0, 60) };
}

const server = http.createServer((req, res) => {
  if (req.url !== "/stream") {
    res.writeHead(404);
    res.end();
    return;
  }

  // Set headers for SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*", // Allow CORS for dev
  });
  res.write("\n");

  const rs = fs.createReadStream(LOG, { encoding: "utf8" });
  let buffer = "";

  rs.on("data", (chunk) => {
    buffer += chunk;
    let parts = buffer.split("\n");
    buffer = parts.pop();

    parts.forEach((line, index) => {
      const ev = parseLineToEvent(line);
      if (ev) {
        // Slow down the output for animation effect
        setTimeout(() => {
          res.write(`data: ${JSON.stringify(ev)}\n\n`);
        }, index * 80); // Stagger events
      }
    });
  });

  rs.on("end", () => {
    setTimeout(() => res.end(), 10000); // Give time for last events to stream
  });
});

server.listen(port, () =>
  console.log("SSE log server running on http://localhost:" + port + "/stream"),
);
