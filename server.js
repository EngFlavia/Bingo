import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createInitialBingoState,
  drawNextNumber,
  resetBingoState
} from "./public/js/bingo-core.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(root, "public");
const port = Number(process.env.PORT || 3000);

let state = createInitialBingoState();
const clients = new Set();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function broadcastState() {
  const message = `event: state\ndata: ${JSON.stringify(state)}\n\n`;

  for (const client of clients) {
    client.write(message);
  }
}

async function serveStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  const normalizedPath = normalize(pathname === "/" ? "/index.html" : pathname);
  const filePath = join(publicDir, normalizedPath);

  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, {
      "content-type": contentTypes[extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store"
    });
    response.end(file);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && requestUrl.pathname === "/api/state") {
    sendJson(response, 200, state);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/draw") {
    state = drawNextNumber(state);
    broadcastState();
    sendJson(response, 200, state);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/reset") {
    state = resetBingoState();
    broadcastState();
    sendJson(response, 200, state);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/events") {
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      connection: "keep-alive",
      "access-control-allow-origin": "*"
    });
    response.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`);
    clients.add(response);

    request.on("close", () => {
      clients.delete(response);
    });
    return;
  }

  if (request.method === "GET") {
    await serveStatic(request, response);
    return;
  }

  response.writeHead(405);
  response.end("Method not allowed");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`App Bingo rodando em http://localhost:${port}`);
  console.log(`Tela de projecao: http://localhost:${port}/?view=display`);
});
