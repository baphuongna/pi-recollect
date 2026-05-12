import * as fs from "node:fs";
import type Database from "better-sqlite3";

export interface MemoryStatusInput {
	action: "status" | "stats" | "reindex" | "compact" | "export";
	format?: "text" | "json";
}

export interface MemoryStats {
	solutions: number;
	sources: number;
	events: number;
	mentalModels: number;
	dbSize: number;
	lastUpdated: string | null;
}

function getStats(db: Database.Database, dbPath: string): MemoryStats {
	const solutions = (db.prepare(`SELECT COUNT(*) as c FROM solutions`).get() as { c: number }).c;
	const sources = (db.prepare(`SELECT COUNT(*) as c FROM sources`).get() as { c: number }).c;
	const events = (db.prepare(`SELECT COUNT(*) as c FROM events`).get() as { c: number }).c;
	const mentalModels = (db.prepare(`SELECT COUNT(*) as c FROM mental_models`).get() as { c: number }).c;

	let dbSize = 0;
	try {
		const stat = fs.statSync(dbPath);
		dbSize = stat.size;
	} catch { /* ignore */ }

	const lastSolution = db.prepare(
		`SELECT updated_at FROM solutions ORDER BY updated_at DESC LIMIT 1`,
	).get() as { updated_at: string } | undefined;

	return {
		solutions,
		sources,
		events,
		mentalModels,
		dbSize,
		lastUpdated: lastSolution?.updated_at ?? null,
	};
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Handle the memory_status tool invocation.
 */
export function handleMemoryStatus(db: Database.Database, dbPath: string, input: MemoryStatusInput): string {
	const format = input.format ?? "text";

	switch (input.action) {
		case "status":
		case "stats": {
			const stats = getStats(db, dbPath);
			if (format === "json") {
				return JSON.stringify(stats, null, 2);
			}
			return [
				`pi-recall Status:`,
				`  Solutions stored: ${stats.solutions}`,
				`  Sources indexed: ${stats.sources}`,
				`  Session events: ${stats.events}`,
				`  Mental models: ${stats.mentalModels}`,
				`  Index size: ${formatBytes(stats.dbSize)}`,
				`  Last updated: ${stats.lastUpdated ?? "never"}`,
			].join("\n");
		}
		case "reindex": {
			// Delete and rebuild FTS5 indexes from sources
			db.exec(`DELETE FROM chunks`);
			db.exec(`DELETE FROM chunks_trigram`);
			const sources = db.prepare(`SELECT id, title, category, metadata FROM sources`).all() as Array<{
				id: string;
				title: string;
				category: string;
				metadata: string;
			}>;
			// Re-insert content from solutions and sources
			const insertChunk = db.prepare(
				`INSERT INTO chunks (source_id, title, content, category) VALUES (?, ?, ?, ?)`,
			);
			const insertTrigram = db.prepare(
				`INSERT INTO chunks_trigram (source_id, content) VALUES (?, ?)`,
			);
			for (const source of sources) {
				const content = source.title; // Use title as content for reindex
				insertChunk.run(source.id, source.title, content, source.category);
				insertTrigram.run(source.id, content);
			}
			return `Reindexed ${sources.length} sources.`;
		}
		case "compact": {
			// VACUUM the database to reclaim space
			db.exec(`VACUUM`);
			const stats = getStats(db, dbPath);
			return `Database compacted. Current size: ${formatBytes(stats.dbSize)}.`;
		}
		case "export": {
			const stats = getStats(db, dbPath);
			if (format === "json") {
				return JSON.stringify({ stats }, null, 2);
			}
			return `Export:\n${JSON.stringify(stats, null, 2)}`;
		}
		default:
			return `Unknown action: ${input.action}`;
	}
}
