import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import type Database from "better-sqlite3";
import { indexContent, removeFromIndex } from "../store/fts5-index.ts";
import { ensurePiMemoryDir, updateMarkdownFile } from "./hierarchical.ts";

export interface StoreMemoryOpts {
	category: "gotcha" | "convention" | "decision" | "pattern" | "architecture";
	title: string;
	content: string;
	files?: string[];
	tags?: string[];
	severity?: "low" | "medium" | "high" | "critical";
}

/**
 * Store a memory entry: insert into sources table + FTS5 indexing.
 * For gotchas and conventions, also update the corresponding markdown file.
 */
export function storeMemory(db: Database.Database, cwd: string, opts: StoreMemoryOpts): string {
	ensurePiMemoryDir(cwd);

	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	const contentHash = crypto.createHash("sha256").update(opts.content).digest("hex");
	const metadata = JSON.stringify({
		files: opts.files ?? [],
		tags: opts.tags ?? [],
		severity: opts.severity ?? "medium",
	});

	// Insert into sources
	db.prepare(`
		INSERT INTO sources (id, type, category, title, content_hash, created_at, updated_at, metadata)
		VALUES (?, 'memory', ?, ?, ?, ?, ?, ?)
	`).run(id, opts.category, opts.title, contentHash, now, now, metadata);

	// Index content into FTS5
	indexContent(db, id, opts.title, opts.content, opts.category);

	// Update category-specific markdown files
	if (opts.category === "gotcha") {
		const existing = tryReadFile(cwd, "gotchas") ?? "# Gotchas\n\n";
		updateMarkdownFile(cwd, "gotchas", existing + `\n## ${opts.title}\n\n${opts.content}\n`);
	} else if (opts.category === "convention") {
		const existing = tryReadFile(cwd, "conventions") ?? "# Conventions\n\n";
		updateMarkdownFile(cwd, "conventions", existing + `\n## ${opts.title}\n\n${opts.content}\n`);
	}

	return id;
}

/**
 * Check if content with the same hash already exists (dedup by content).
 */
export function hasContentHash(db: Database.Database, content: string): boolean {
	const hash = crypto.createHash("sha256").update(content).digest("hex");
	const row = db.prepare(`SELECT 1 FROM sources WHERE content_hash = ? LIMIT 1`).get(hash);
	return row !== undefined;
}

/**
 * Remove a memory by source ID.
 */
export function removeMemory(db: Database.Database, id: string): void {
	removeFromIndex(db, id);
	db.prepare(`DELETE FROM sources WHERE id = ?`).run(id);
}

function tryReadFile(cwd: string, name: string): string | null {
	try {
		return fs.readFileSync(path.join(cwd, ".pi-recall", `${name}.md`), "utf-8");
	} catch {
		return null;
	}
}
