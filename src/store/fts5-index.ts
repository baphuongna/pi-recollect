import type Database from "better-sqlite3";

/**
 * Index content into both FTS5 tables (porter + trigram).
 */
export function indexContent(
	db: Database.Database,
	sourceId: string,
	title: string,
	content: string,
	category: string,
): void {
	// Insert into porter-stemmed FTS5 index
	const insertChunk = db.prepare(
		`INSERT INTO chunks (source_id, title, content, category) VALUES (?, ?, ?, ?)`,
	);
	insertChunk.run(sourceId, title, content, category);

	// Insert into trigram FTS5 index
	const insertTrigram = db.prepare(
		`INSERT INTO chunks_trigram (source_id, content) VALUES (?, ?)`,
	);
	insertTrigram.run(sourceId, content);
}

/**
 * Remove all indexed content for a given source from both FTS5 tables.
 */
export function removeFromIndex(db: Database.Database, sourceId: string): void {
	db.prepare(`DELETE FROM chunks WHERE source_id = ?`).run(sourceId);
	db.prepare(`DELETE FROM chunks_trigram WHERE source_id = ?`).run(sourceId);
}
