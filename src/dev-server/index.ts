import type { DevServerConfig } from "./types.js";
import { build } from "../engine/index.js";
import { createLoggerSync } from "../logger/index.js";
import { existsSync } from "node:fs";
import { watch } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, resolve, normalize } from "node:path";
import { createHash } from "node:crypto";
import type { Duplex } from "node:stream";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".xml": "application/xml",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

type WsClient = IncomingMessage & { socket: Duplex };

/**
 * Starts a development server with hot reload for the documentation.
 *
 * @param rootDir - The project root directory.
 * @param config - Dev server configuration.
 */
export async function startDevServer(rootDir: string, config: DevServerConfig): Promise<void> {
  const logger = createLoggerSync();
  const outputDir = join(rootDir, "docs");
  const clients = new Set<WsClient>();

  logger.info("Starting development build...");
  await build({ rootDir, logger });
  logger.success("Initial build complete");

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "/";
    let filePath = join(outputDir, url === "/" ? "index.html" : url);

    // Security: validate resolved path stays within outputDir to prevent path traversal
    const resolvedPath = normalize(filePath);
    if (!resolvedPath.startsWith(outputDir)) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Forbidden");
      return;
    }

    if (!extname(filePath)) {
      filePath += ".html";
    }

    try {
      const fileStat = await stat(filePath);
      if (fileStat.isFile()) {
        const content = await readFile(filePath);
        const ext = extname(filePath);
        const mime = MIME_TYPES[ext] ?? "application/octet-stream";
        res.writeHead(200, { "Content-Type": mime });
        res.end(content);
        return;
      }
    } catch {
      // File not found — serve index.html for SPA-style routing
    }

    try {
      const content = await readFile(join(outputDir, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(content);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    }
  });

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (req.url === "/__vetwo_hmr") {
      const ws = upgradeToWebSocket(req, socket, head);
      if (ws) {
        clients.add(ws);
        ws.socket.on("close", () => clients.delete(ws));
      }
    } else {
      socket.destroy();
    }
  });

  let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  let isRebuilding = false;

  const notifyClients = () => {
    const payload = Buffer.from("reload");
    for (const client of clients) {
      try {
        const mask = Buffer.alloc(4);
        mask.writeUInt32BE(Math.random() * 0xffffffff, 0);

        const frame = Buffer.alloc(2 + 4 + payload.length);
        frame[0] = 0x81; // FIN + text
        frame[1] = 0x80 | payload.length; // masked
        mask.copy(frame, 2);
        for (let i = 0; i < payload.length; i++) {
          const payloadByte = payload[i];
          const maskByte = mask[i % 4];
          if (payloadByte !== undefined && maskByte !== undefined) {
            frame[6 + i] = payloadByte ^ maskByte;
          }
        }
        client.socket.write(frame);
      } catch {
        clients.delete(client);
      }
    }
  };

  const scheduleRebuild = () => {
    if (isRebuilding) return;
    if (rebuildTimer) clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(async () => {
      isRebuilding = true;
      logger.info("Rebuilding...");
      try {
        await build({ rootDir, logger });
        logger.success("Rebuild complete");
        notifyClients();
      } catch (err) {
        logger.error(`Rebuild failed: ${err}`);
      } finally {
        isRebuilding = false;
      }
    }, 300);
  };

  const watchDirs = [
    join(rootDir, config.sourceDir ?? "src"),
    ...config.extraWatch.map((d) => resolve(rootDir, d)),
  ];
  for (const dir of watchDirs) {
    if (existsSync(dir)) {
      watch(dir, { recursive: true }, () => {
        scheduleRebuild();
      });
    }
  }

  server.listen(config.port, config.host, () => {
    const url = `http://${config.host}:${config.port}`;
    logger.success(`Development server running at ${url}`);
    logger.info("Watching for changes...");

    if (config.open) {
      import("node:child_process")
        .then(({ exec }) => {
          const cmd =
            process.platform === "darwin"
              ? "open"
              : process.platform === "win32"
                ? "start"
                : "xdg-open";
          exec(`${cmd} ${url}`);
        })
        .catch(() => {
          // Browser open not available
        });
    }
  });
}

function upgradeToWebSocket(req: IncomingMessage, socket: Duplex, _head: Buffer): WsClient | null {
  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return null;
  }

  const acceptKey = createHash("sha1")
    .update(key + "258EAFA5-E914-47DA-95CA-5AB95000D74A")
    .digest("base64");

  const headers = [
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${acceptKey}`,
    "",
    "",
  ].join("\r\n");

  socket.write(headers);

  const client = Object.assign(req, { socket });

  socket.on("data", (data: Buffer) => {
    if (data.length >= 2) {
      const firstByte = data[0];
      if (firstByte !== undefined && (firstByte & 0x0f) === 9) {
        const pong = Buffer.alloc(2);
        pong[0] = 0x8a;
        pong[1] = 0x00;
        socket.write(pong);
      }
    }
  });

  return client;
}
