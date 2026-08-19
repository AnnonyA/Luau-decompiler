import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decompile, parseQueryOptions } from "./decompile.js";

function loadPage(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(here, "frontend/index.html"), join(here, "../src/frontend/index.html")];
  for (const path of candidates) {
    if (existsSync(path)) {
      return readFileSync(path, "utf8");
    }
  }
  return "<!doctype html><title>Luau decompiler</title><p>frontend missing</p>";
}

const PAGE = loadPage();

export function startServer(port = 3000, host = "0.0.0.0"): ReturnType<typeof createServer> {
  const server = createServer((request, response) => {
    void handle(request, response);
  });
  server.listen(port, host);
  return server;
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  setCors(response);
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }
  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(PAGE);
    return;
  }
  if (request.method === "POST" && (url.pathname === "/decompile" || url.pathname === "/luau/decompile")) {
    try {
      const bytes = await readBody(request);
      const result = decompile(bytes, parseQueryOptions(url.searchParams));
      if (!result.ok) {
        response.writeHead(400, { "Content-Type": "application/json" });
        response.end(JSON.stringify(result));
        return;
      }
      const wantsText = (request.headers.accept ?? "").includes("text/plain") && url.searchParams.get("format") === "source";
      if (wantsText) {
        response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        response.end(result.source);
        return;
      }
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          ok: true,
          source: result.source,
          disassembly: result.disassembly,
          diagnostics: result.diagnostics,
          profile: result.profile,
        }),
      );
    } catch (error) {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    }
    return;
  }
  response.writeHead(404, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ ok: false, error: "not found" }));
}

function setCors(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function readBody(request: IncomingMessage): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks);
  const type = request.headers["content-type"] ?? "";
  if (type.includes("text/plain") || type.includes("application/base64")) {
    const text = raw.toString("utf8").replace(/\s+/g, "");
    return Uint8Array.from(Buffer.from(text, "base64"));
  }
  return new Uint8Array(raw);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT ?? 3000);
  startServer(port);
  process.stdout.write(`listening on ${port}\n`);
}
