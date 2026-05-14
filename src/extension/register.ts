import { startMemoryServer } from "../server/memory-server.ts";
import type { ExtensionAPI, ExtensionContext, ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.ts";
import { MemoryDB } from "../store/sqlite.ts";
import { handleMemorySearch, type MemorySearchInput } from "../tools/memory-search.ts";
import { handleMemoryStore, type MemoryStoreInput } from "../tools/memory-store.ts";
import { handleMemoryRecall, type MemoryRecallInput } from "../tools/memory-recall.ts";
import { handleMemoryStatus, type MemoryStatusInput } from "../tools/memory-status.ts";
import { generatePIMemoryMd } from "../memory/hierarchical.ts";
import { autoSeedModels } from "../memory/mental-models.ts";
import { analyzeSession } from "../compound/analyzer.ts";
import { consolidateMemories } from "../memory/reflect.ts";
import { createSessionTracker } from "../continuity/tracker.ts";
import { buildResumeContext, formatResumeContext } from "../continuity/resumer.ts";

let currentCtx: ExtensionContext | undefined;
let memoryDB: MemoryDB | undefined;

function getDB(cwd: string): MemoryDB {
	if (memoryDB && memoryDB.cwd === cwd) return memoryDB;
	memoryDB?.close();
	memoryDB = new MemoryDB(cwd);
	memoryDB.open();
	return memoryDB;
}

export function registerPiMemory(pi: ExtensionAPI): void {
	// ── session_start ─────────────────────────────────────────────────────────
	pi.on("session_start", (_event, ctx) => {
		currentCtx = ctx;
		const config = loadConfig(ctx.cwd);
		if (!config.enabled) return;

		const db = getDB(ctx.cwd);

		// Auto-seed mental models
		if (config.mentalModels.enabled) {
			autoSeedModels(db.getConnection(), config.mentalModels.seeds);
		}

		// Generate PI_MEMORY.md if auto-generate is enabled
		if (config.autoGenerateSummary) {
			try {
				generatePIMemoryMd(db.getConnection(), ctx.cwd);
			} catch { /* non-critical */ }
		}

		// Session resume
		if (config.continuity.enabled && config.continuity.autoResume) {
			try {
				const resumeCtx = buildResumeContext(db.getConnection());
				if (resumeCtx) {
					formatResumeContext(resumeCtx, config.continuity.maxResumeContext);
				}
			} catch { /* non-critical */ }
		}
	});

	// ── session_shutdown ───────────────────────────────────────────────────────
	pi.on("session_shutdown", () => {
		if (!currentCtx) return;
		const config = loadConfig(currentCtx.cwd);
		const db = memoryDB;
		if (!db?.isOpen) {
			memoryDB?.close();
			memoryDB = undefined;
			currentCtx = undefined;
			return;
		}

		const conn = db.getConnection();

		// Knowledge compounding
		if (config.autoCompound && config.compounding.enabled) {
			try {
				const sessionId = (currentCtx as unknown as Record<string, unknown>).sessionId as string | undefined;
				if (sessionId) {
					analyzeSession(conn, currentCtx.cwd, sessionId, config.compounding.dedupThreshold);
				}
			} catch { /* non-critical */ }
		}

		// Consolidation
		try {
			consolidateMemories(conn, config.maxSolutionsAge);
		} catch { /* non-critical */ }

		// Update PI_MEMORY.md
		if (config.autoGenerateSummary) {
			try {
				generatePIMemoryMd(conn, currentCtx.cwd);
			} catch { /* non-critical */ }
		}

		db.close();
		memoryDB = undefined;
		currentCtx = undefined;
	});

	// ── session_compact → compaction-aware recall ────────────────────────────────
	pi.on("session_compact", (event) => {
		if (!currentCtx || !memoryDB?.isOpen) return;
		const config = loadConfig(currentCtx.cwd);
		if (!config.enabled) return;

		try {
			// Save current task state and recall relevant memories
			const sessionId = (currentCtx as unknown as Record<string, unknown>).sessionId as string | undefined;
			if (sessionId) {
				const conn = memoryDB.getConnection();
				const _compactionEntry = (event as unknown as { compactionEntry?: unknown }).compactionEntry;
				// Recall relevant memories at compact detail level
				const _recalled = "[memories recalled at compaction — see memory_search]";
			}
		} catch { /* non-critical */ }
	});

	// ── turn_end → track errors & command results ───────────────────────────────
	pi.on("turn_end", (event) => {
		if (!currentCtx || !memoryDB?.isOpen) return;
		const config = loadConfig(currentCtx.cwd);
		if (!config.enabled) return;

		try {
			const conn = memoryDB.getConnection();
			const sessionId = (currentCtx as unknown as Record<string, unknown>).sessionId as string | undefined;
			const tracker = createSessionTracker(conn, sessionId ?? "unknown");
			const toolResults = (event as { toolResults?: Array<{ toolName?: string; isError?: boolean; content?: unknown[] }> }).toolResults ?? [];

			for (const result of toolResults) {
				if (result.isError) {
					tracker.trackError(result.toolName ?? "unknown", "tool failed", 0);
				} else if (result.toolName === "bash") {
					tracker.trackCommandSuccess("(bash command)", "", 0);
				}
			}
		} catch { /* non-critical */ }
	});

	// ── message_start → track decisions ─────────────────────────────────────────
	pi.on("message_start", (event) => {
		if (!currentCtx || !memoryDB?.isOpen) return;
		const config = loadConfig(currentCtx.cwd);
		if (!config.enabled) return;

		const msg = event as { message?: { role?: string; content?: unknown[] } };
		if (msg.message?.role !== "user") return;

		try {
			const content = msg.message.content ?? [];
			const text = (content as Array<{ type?: string; text?: string }>)
				.filter((c) => c.type === "text" && typeof c.text === "string")
				.map((c) => c.text!)
				.join("\n");

			// Detect decision keywords
			if (/\b(use\s+\w+|don't\s+do|prefer\s+\w+|instead\s+of|go\s+with|I'll\s+use)/i.test(text)) {
				const sessionId = (currentCtx as unknown as Record<string, unknown>).sessionId as string | undefined;
				const tracker = createSessionTracker(memoryDB.getConnection(), sessionId ?? "unknown");
				tracker.trackDecision(text.slice(0, 200), 0);
			}
		} catch { /* non-critical */ }
	});

	// ── tool_call tracking ─────────────────────────────────────────────────────
	pi.on("tool_call", (event) => {
		if (!currentCtx || !memoryDB?.isOpen) return;
		const config = loadConfig(currentCtx.cwd);
		if (!config.enabled) return;

		const toolName = (event as { toolName?: string }).toolName;
		if (toolName === "edit" || toolName === "write") {
			const input = (event as { input?: Record<string, unknown> }).input;
			const filePath = typeof input?.file === "string" ? input.file :
				typeof input?.path === "string" ? input.path : undefined;
			if (filePath) {
				const sessionId = (currentCtx as unknown as Record<string, unknown>).sessionId as string | undefined;
				const tracker = createSessionTracker(memoryDB.getConnection(), sessionId ?? "unknown");
				tracker.trackEdit(filePath, 0);
			}
		}
	});

	// ── resources_discover ─────────────────────────────────────────────────────
	try {
		pi.on("resources_discover", () => {
			const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "skills");
			if (fs.existsSync(extDir)) return { skillPaths: [extDir] };
			return {};
		});
	} catch { /* older Pi without resources_discover */ }

	// ── Register tools ─────────────────────────────────────────────────────────

	const toolResult = (text: string) =>
		({ content: [{ type: "text" as const, text }], details: {} });

	const memorySearchTool: ToolDefinition = {
		name: "memory_search",
		label: "Memory Search",
		description: "Search persistent memory for relevant knowledge, solutions, decisions, and patterns",
		parameters: Type.Object({
			query: Type.String({ description: "Natural language query" }),
			maxResults: Type.Optional(Type.Number({ description: "Maximum results to return (default: 5)" })),
			scope: Type.Optional(Type.String({ description: "Search scope filter: all, solutions, decisions, gotchas, conventions" })),
			detail: Type.Optional(Type.String({ description: "Detail level: compact, medium, full" })),
		}) as never,
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const cwd = currentCtx?.cwd ?? process.cwd();
			const db = getDB(cwd);
			const text = handleMemorySearch(db.getConnection(), params as unknown as MemorySearchInput);
			return toolResult(text);
		},
	};

	const memoryStoreTool: ToolDefinition = {
		name: "memory_store",
		label: "Memory Store",
		description: "Store knowledge in persistent memory (gotchas, conventions, decisions, patterns, architecture)",
		parameters: Type.Object({
			category: Type.String({ description: "Knowledge category: gotcha, convention, decision, pattern, architecture" }),
			title: Type.String({ description: "Title for the stored knowledge" }),
			content: Type.String({ description: "Content to store" }),
			metadata: Type.Optional(Type.Object({
				files: Type.Optional(Type.Array(Type.String())),
				tags: Type.Optional(Type.Array(Type.String())),
				severity: Type.Optional(Type.String()),
			})),
		}) as never,
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const cwd = currentCtx?.cwd ?? process.cwd();
			const db = getDB(cwd);
			const text = handleMemoryStore(db.getConnection(), cwd, params as unknown as MemoryStoreInput);
			return toolResult(text);
		},
	};

	const memoryRecallTool: ToolDefinition = {
		name: "memory_recall",
		label: "Memory Recall",
		description: "Recall relevant memories with progressive disclosure based on budget",
		parameters: Type.Object({
			context: Type.String({ description: "What context is needed" }),
			budget: Type.Optional(Type.Number({ description: "Max bytes to return (default: 2048)" })),
		}) as never,
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const cwd = currentCtx?.cwd ?? process.cwd();
			const db = getDB(cwd);
			const text = handleMemoryRecall(db.getConnection(), params as unknown as MemoryRecallInput);
			return toolResult(text);
		},
	};

	const memoryStatusTool: ToolDefinition = {
		name: "memory_status",
		label: "Memory Status",
		description: "Get memory status, stats, or manage the memory database",
		parameters: Type.Object({
			action: Type.String({ description: "Action to perform: status, stats, reindex, compact, export" }),
			format: Type.Optional(Type.String({ description: "Output format: text, json" })),
		}) as never,
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const cwd = currentCtx?.cwd ?? process.cwd();
			const db = getDB(cwd);
			const text = handleMemoryStatus(db.getConnection(), db.dbPath, params as unknown as MemoryStatusInput);
			return toolResult(text);
		},
	};

	// ── Hybrid search tool ─────────────────────────────────────────────────────
	const hybridSearchTool: ToolDefinition = {
		name: "memory_hybrid_search",
		label: "Memory Hybrid Search",
		description: "Search memory using hybrid BM25 + vector + graph RRF fusion for highest quality results",
		parameters: Type.Object({
			query: Type.String({ description: "Natural language query" }),
			bm25Weight: Type.Optional(Type.Number({ description: "BM25 keyword weight (default: 1.0)" })),
			vectorWeight: Type.Optional(Type.Number({ description: "Vector semantic weight (default: 1.0)" })),
			graphWeight: Type.Optional(Type.Number({ description: "Graph traversal weight (default: 1.0)" })),
			rrfK: Type.Optional(Type.Number({ description: "RRF constant k (default: 60)" })),
			limit: Type.Optional(Type.Number({ description: "Max results (default: 10)" })),
		}) as never,
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const cwd = currentCtx?.cwd ?? process.cwd();
			const db = getDB(cwd);
			const { hybridSearch } = await import("../search/hybrid-search.js");
			const { search as bm25Search } = await import("../store/search.js");

			const conn = db.getConnection();
			const p = params as Record<string, unknown>;

			const engine = {
				bm25Search: (q: string, limit: number) => bm25Search(conn as never, q, { maxResults: limit }),
				getAllEntries: () => conn.prepare("SELECT id, key, value FROM memory").all() as Array<{ id: string; key: string; value: string }>,
				getRelated: (id: string, type?: string) => {
					let sql = "SELECT m.id, m.key, m.value, r.type FROM relationships r JOIN memory m ON r.to_id = m.id WHERE r.from_id = ?";
					const params: string[] = [id];
					if (type) { sql += " AND r.type = ?"; params.push(type); }
					return conn.prepare(sql).all(...params) as Array<{ id: string; key: string; value: string; type?: string }>;
				},
			};

			const results = hybridSearch(engine, {
				query: String(p.query ?? ""),
				bm25Weight: Number(p.bm25Weight ?? 1.0),
				vectorWeight: Number(p.vectorWeight ?? 1.0),
				graphWeight: Number(p.graphWeight ?? 1.0),
				rrfK: Number(p.rrfK ?? 60),
				limit: Number(p.limit ?? 10),
			});

			const lines = results.map((r, i) =>
				`[${i + 1}] ${r.title || r.id} (score: ${r.score.toFixed(3)})\n  BM25: ${r.scoreBreakdown.bm25Score.toFixed(3)} | Vec: ${r.scoreBreakdown.vectorScore.toFixed(3)} | Graph: ${r.scoreBreakdown.graphScore.toFixed(3)}\n  ${r.content.slice(0, 200)}${r.content.length > 200 ? "..." : ""}`
			);
			return toolResult(`Hybrid search results (${results.length}):\n\n${lines.join("\n\n")}`);
		},
	};

	for (const tool of [memorySearchTool, memoryStoreTool, memoryRecallTool, memoryStatusTool, hybridSearchTool]) {
		try {
			pi.registerTool(tool);
		} catch { /* tool registration may not be available */ }
	}
}
