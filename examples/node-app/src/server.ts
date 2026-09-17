import { createServer as httpCreateServer, type IncomingMessage, type ServerResponse } from "node:http";

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  res.setHeader("Content-Type", "application/json");

  if (req.url === "/" && req.method === "GET") {
    res.end(JSON.stringify({ status: "ok", uptime: process.uptime() }));
    return;
  }

  if (req.url?.startsWith("/api/hello") && req.method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const name = url.searchParams.get("name") ?? "world";
    res.end(JSON.stringify({ message: `Hello, ${name}!` }));
    return;
  }

  if (req.url === "/api/echo" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body);
        res.end(JSON.stringify({ echo: parsed }));
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: "Not found" }));
}

export function createServer(port = 3000) {
  const server = httpCreateServer(handleRequest);
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
  return server;
}

createServer();
