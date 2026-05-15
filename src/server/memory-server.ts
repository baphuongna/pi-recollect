/**
 * Standalone Memory Server
 * REST API + MCP proxy mode on port 3111
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { MemoryDB } from "../store/sqlite.js";
import { hybridSearch, type HybridSearchEngine, type HybridSearchOptions, type HybridSearchResult } from "../search/hybrid-search.js";
import { search as bm25Search } from "../store/search.js";
import type { MemoryEntry } from "../graph/memory-store.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MemoryServerConfig {
  port?: number;
  /** Default: 127.0.0.1 (localhost) for security */
  host?: string;
  /** Run in MCP proxy mode (JSON-RPC over HTTP) */
  mcpMode?: boolean;
  /** CORS allowed origins */
  corsOrigins?: string[];
  /** Working directory for database */
  cwd?: string;
  /** Authentication token - if set, all requests must include Bearer token */
  authToken?: string;
}

interface JsonRequest {
  method: string;
  path: string;
  params?: Record<string, string>;
  body?: unknown;
}

type RequestHandler = (req: IncomingMessage, res: ServerResponse, parsed: JsonRequest) => Promise<void>;

// ── CORS helpers ───────────────────────────────────────────────────────────────

function setCorsHeaders(res: ServerResponse, origins: string[]): void {
  res.setHeader("Access-Control-Allow-Origin", origins[0] ?? "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// ── JSON helpers ─────────────────────────────────────────────────────────────

async function parseJson<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try { resolve(JSON.parse(data)); }
      catch (e) { reject(new Error(`Invalid JSON: ${String(e)}`)); }
    });
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body, null, 2));
}

// ── Hybrid search engine factory ───────────────────────────────────────────────

interface GraphMemoryStoreLike {
  query(q: { query?: string; limit?: number }): MemoryEntry[];
  getRelated(id: string, type?: string): MemoryEntry[];
}

function createHybridEngine(db: MemoryDB): HybridSearchEngine {
  return {
    bm25Search(query: string, limit: number) {
      return bm25Search(db.getConnection(), query, { maxResults: limit });
    },
    getAllEntries() {
      // Use the existing query API for all entries
      return db.getConnection()
        .prepare("SELECT id, key, value FROM memory")
        .all() as Array<{ id: string; key: string; value: string }>;
    },
    getRelated(id: string, type?: string) {
      const conn = db.getConnection();
      let sql = `
        SELECT m.id, m.key, m.value, r.type
        FROM relationships r
        JOIN memory m ON r.to_id = m.id
        WHERE r.from_id = ?
      `;
      const params: string[] = [id];
      if (type) { sql += " AND r.type = ?"; params.push(type); }
      return conn.prepare(sql).all(...params) as Array<{ id: string; key: string; value: string; type?: string }>;
    },
  };
}

// ── Route handlers ────────────────────────────────────────────────────────────

interface ServerContext {
  db: MemoryDB;
  store: { remember: Function; getRelated: Function };
  config: MemoryServerConfig;
}

async function handleHealth(_req: IncomingMessage, res: ServerResponse, _parsed: JsonRequest): Promise<void> {
  json(res, 200, {
    status: "ok",
    service: "pi-recollect-memory-server",
    version: "1.0.0",
    timestamp: Date.now(),
  });
}

async function handleSearch(req: IncomingMessage, res: ServerResponse, parsed: JsonRequest): Promise<void> {
  try {
    const ctx = (req as unknown as { _ctx?: ServerContext })._ctx;
    if (!ctx) { json(res, 500, { error: "Server not initialized" }); return; }

    const options: HybridSearchOptions = {
      query: parsed.params?.q ?? (parsed.body as Record<string, unknown>)?.query as string ?? "",
      bm25Weight: (parsed.body as Record<string, unknown>)?.bm25Weight as number ?? 1.0,
      vectorWeight: (parsed.body as Record<string, unknown>)?.vectorWeight as number ?? 1.0,
      graphWeight: (parsed.body as Record<string, unknown>)?.graphWeight as number ?? 1.0,
      rrfK: (parsed.body as Record<string, unknown>)?.rrfK as number ?? 60,
      limit: (parsed.body as Record<string, unknown>)?.limit as number ?? 10,
    };

    if (!options.query) {
      json(res, 400, { error: "query parameter required" });
      return;
    }

    const engine = createHybridEngine(ctx.db);
    const results = hybridSearch(engine, options);
    json(res, 200, { results, count: results.length });
  } catch (e) {
    json(res, 500, { error: String(e) });
  }
}

async function handleStore(req: IncomingMessage, res: ServerResponse, parsed: JsonRequest): Promise<void> {
  try {
    const ctx = (req as unknown as { _ctx?: ServerContext })._ctx;
    if (!ctx) { json(res, 500, { error: "Server not initialized" }); return; }

    const body = parsed.body as { key?: string; value?: string; type?: string; tags?: string[] } ?? {};
    if (!body.key || !body.value) {
      json(res, 400, { error: "key and value required" });
      return;
    }

    const entry = await ctx.store.remember(
      body.key,
      body.value,
      (body.type as MemoryEntry["type"]) ?? "observation",
      { tags: body.tags }
    );
    json(res, 201, { entry, message: "stored" });
  } catch (e) {
    json(res, 500, { error: String(e) });
  }
}

async function handleRecall(req: IncomingMessage, res: ServerResponse, parsed: JsonRequest): Promise<void> {
  try {
    const ctx = (req as unknown as { _ctx?: ServerContext })._ctx;
    if (!ctx) { json(res, 500, { error: "Server not initialized" }); return; }

    const q = parsed.params?.q ?? (parsed.body as Record<string, unknown>)?.query as string ?? "";
    const limit = (parsed.body as Record<string, unknown>)?.limit as number ?? parsed.params?.limit ? parseInt(parsed.params!.limit!) : 10;

    // Escape SQL LIKE wildcards to prevent injection
    const escapedQ = q.replace(/[%_\\]/g, "\\$&");
    const likePattern = `%${escapedQ}%`;

    const conn = ctx.db.getConnection();
    const rows = conn
      .prepare("SELECT * FROM memory WHERE key LIKE ? ESCAPE '\\' OR value LIKE ? ESCAPE '\\' LIMIT ?")
      .all(likePattern, likePattern, limit) as Array<{
        id: string; key: string; value: string; type: string;
        created_at: number; updated_at: number; status: string; project: string; tags: string;
      }>;

    const entries = rows.map((r) => ({
      id: r.id, key: r.key, value: r.value, type: r.type,
      createdAt: r.created_at, updatedAt: r.updated_at,
      status: r.status, project: r.project,
      tags: JSON.parse(r.tags || "[]") as string[],
    }));

    json(res, 200, { entries, count: entries.length });
  } catch (e) {
    json(res, 500, { error: String(e) });
  }
}

async function handleStatus(_req: IncomingMessage, res: ServerResponse, _parsed: JsonRequest): Promise<void> {
  try {
    const ctx = (_req as unknown as { _ctx?: ServerContext })._ctx;
    if (!ctx) { json(res, 500, { error: "Server not initialized" }); return; }

    const conn = ctx.db.getConnection();
    const stats = conn.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) as closed,
        SUM(CASE WHEN type='decision' THEN 1 ELSE 0 END) as decisions,
        SUM(CASE WHEN type='pattern' THEN 1 ELSE 0 END) as patterns,
        SUM(CASE WHEN type='solution' THEN 1 ELSE 0 END) as solutions
      FROM memory
    `).get() as Record<string, number>;

    const relCount = (conn.prepare("SELECT COUNT(*) as c FROM relationships").get() as { c: number }).c;

    json(res, 200, {
      dbPath: ctx.db.dbPath,
      isOpen: ctx.db.isOpen,
      stats: { ...stats, relationships: relCount },
      timestamp: Date.now(),
    });
  } catch (e) {
    json(res, 500, { error: String(e) });
  }
}

// ── MCP proxy mode ────────────────────────────────────────────────────────────

async function handleMcpProxy(req: IncomingMessage, res: ServerResponse, parsed: JsonRequest): Promise<void> {
  const ctx = (req as unknown as { _ctx?: ServerContext })._ctx;
  if (!ctx) { json(res, 500, { error: "Server not initialized" }); return; }

  const body = parsed.body as { method?: string; params?: unknown } ?? {};

  switch (body.method) {
    case "search": {
      const params = body.params as { query?: string; limit?: number };
      const engine = createHybridEngine(ctx.db);
      const results = hybridSearch(engine, {
        query: params?.query ?? "",
        limit: params?.limit ?? 10,
      });
      json(res, 200, { jsonrpc: "2.0", result: results, id: 1 });
      break;
    }
    case "store": {
      const params = body.params as { key?: string; value?: string; type?: string };
      const entry = await ctx.store.remember(
        params?.key ?? "",
        params?.value ?? "",
        (params?.type as MemoryEntry["type"]) ?? "observation"
      );
      json(res, 200, { jsonrpc: "2.0", result: entry, id: 1 });
      break;
    }
    case "get_related": {
      const params = body.params as { id?: string; type?: string };
      const related = ctx.store.getRelated(params?.id ?? "", params?.type);
      json(res, 200, { jsonrpc: "2.0", result: related, id: 1 });
      break;
    }
    default:
      json(res, 400, { jsonrpc: "2.0", error: { code: -32601, message: "Method not found" }, id: 1 });
  }
}

// ── Routes map ───────────────────────────────────────────────────────────────

const ROUTES: Array<{ method: string; path: string; handler: RequestHandler }> = [
  { method: "GET", path: "/health", handler: handleHealth },
  { method: "GET", path: "/status", handler: handleStatus },
  { method: "POST", path: "/search", handler: handleSearch },
  { method: "POST", path: "/store", handler: handleStore },
  { method: "GET", path: "/recall", handler: handleRecall },
  { method: "POST", path: "/mcp", handler: handleMcpProxy },
];

// ── Server class ──────────────────────────────────────────────────────────────

export class MemoryServerInstance {
  public readonly db: MemoryDB;
  public readonly config: MemoryServerConfig;
  private readonly _server: ReturnType<typeof createServer>;

  constructor(cwd: string, config: MemoryServerConfig = {}) {
    this.config = { ...config, cwd };
    this.db = new MemoryDB(cwd);
    this.db.open();

    const corsOrigins = config.corsOrigins ?? ["*"];

    this._server = createServer(async (req, res) => {
      // Attach context for route handlers
      const ctx: ServerContext = {
        db: this.db,
        store: this._store,
        config: this.config,
      };
      (req as unknown as { _ctx?: ServerContext })._ctx = ctx;

      setCorsHeaders(res, corsOrigins);
      if (req.method === "OPTIONS") {
        res.writeHead(204); res.end(); return;
      }

      // Auth validation if token is configured
      if (this.config.authToken) {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
        if (token !== this.config.authToken) {
          json(res, 401, { error: "Unauthorized", message: "Valid auth token required" });
          return;
        }
      }

      const url = new URL(req.url ?? "/", `http://localhost:${config.port ?? 3111}`);
      const path = url.pathname;

      const route = ROUTES.find(
        (r) => r.method === (req.method ?? "GET") && r.path === path
      );
      if (!route) {
        json(res, 404, { error: "Not found", path });
        return;
      }

      let body: unknown;
      if (req.method === "POST") {
        try { body = await parseJson(req); } catch { body = undefined; }
      }

      const parsed: JsonRequest = {
        method: req.method ?? "GET",
        path,
        params: Object.fromEntries(url.searchParams),
        body,
      };

      try {
        await route.handler(req, res, parsed);
      } catch (e) {
        json(res, 500, { error: String(e) });
      }
    });
  }

  private _store = {
    remember: (() => {
      let store: import("../graph/memory-store.js").GraphMemoryStore | null = null;
      return async (key: string, value: string, type: MemoryEntry["type"], opts: { tags?: string[] }) => {
        if (!store) {
          const { GraphMemoryStore } = await import("../graph/memory-store.js");
          store = new GraphMemoryStore(this.db.dbPath);
        }
        return store.remember(key, value, type, opts);
      };
    })(),
    getRelated: (() => {
      let store: import("../graph/memory-store.js").GraphMemoryStore | null = null;
      return (id: string, type?: string) => {
        if (!store) {
          const { GraphMemoryStore } = require("../graph/memory-store.js");
          store = new GraphMemoryStore(this.db.dbPath);
        }
        return store!.getRelated(id, type);
      };
    })(),
  };

  listen(port?: number, host?: string): Promise<void> {
    // Default to localhost (127.0.0.1) for security instead of 0.0.0.0
    const listenHost = host ?? this.config.host ?? "127.0.0.1";
    return new Promise((resolve) => {
      this._server.listen(port ?? this.config.port ?? 3111, listenHost, () => resolve());
    });
  }

  close(): void {
    this._server.close();
    this.db.close();
  }
}

// ── Exported factory ───────────────────────────────────────────────────────────

export type { HybridSearchOptions, HybridSearchResult, HybridSearchEngine };

export async function startMemoryServer(
  cwd: string,
  config: MemoryServerConfig = {}
): Promise<MemoryServerInstance> {
  const server = new MemoryServerInstance(cwd, config);
  // Default to localhost for security
  await server.listen(config.port ?? 3111, config.host ?? "127.0.0.1");
  return server;
}