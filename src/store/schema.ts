import type Database from "better-sqlite3";

/**
 * Initialize all tables, indexes, and pragmas for the pi-recall database.
 * Safe to call multiple times — uses IF NOT EXISTS.
 */
export function initSchema(db: Database.Database): void {
	// Pragmas
	db.pragma("journal_mode = WAL");
	db.pragma("synchronous = NORMAL");
	db.pragma("cache_size = -64000");
	db.pragma("foreign_keys = ON");
	db.pragma("busy_timeout = 5000");

	// Sources: indexed content with metadata
	db.exec(`
		CREATE TABLE IF NOT EXISTS sources (
			id TEXT PRIMARY KEY,
			type TEXT NOT NULL,
			category TEXT,
			title TEXT,
			content_hash TEXT,
			file_path TEXT,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			metadata TEXT
		);
	`);

	// FTS5 index: porter stemmer (conceptual search)
	db.exec(`
		CREATE VIRTUAL TABLE IF NOT EXISTS chunks USING fts5(
			source_id,
			title,
			content,
			category,
			tokenize="porter unicode61"
		);
	`);

	// FTS5 index: trigram (exact substring search)
	db.exec(`
		CREATE VIRTUAL TABLE IF NOT EXISTS chunks_trigram USING fts5(
			source_id,
			content,
			tokenize="trigram"
		);
	`);

	// Vocabulary: term frequency stats
	db.exec(`
		CREATE TABLE IF NOT EXISTS vocabulary (
			term TEXT PRIMARY KEY,
			doc_count INTEGER NOT NULL DEFAULT 0,
			total_count INTEGER NOT NULL DEFAULT 0
		);
	`);

	// Events: session tracking
	db.exec(`
		CREATE TABLE IF NOT EXISTS events (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			session_id TEXT,
			type TEXT NOT NULL,
			data TEXT NOT NULL,
			timestamp TEXT NOT NULL
		);
	`);

	// Solutions: compound knowledge
	db.exec(`
		CREATE TABLE IF NOT EXISTS solutions (
			id TEXT PRIMARY KEY,
			problem_type TEXT NOT NULL,
			category TEXT,
			title TEXT NOT NULL,
			content TEXT NOT NULL,
			files TEXT,
			tags TEXT,
			severity TEXT,
			overlap_hash TEXT,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			access_count INTEGER DEFAULT 0,
			last_accessed_at TEXT
		);
	`);

	// Mental models: curated summaries
	db.exec(`
		CREATE TABLE IF NOT EXISTS mental_models (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL UNIQUE,
			content TEXT NOT NULL,
			source_ids TEXT,
			budget_chars INTEGER DEFAULT 16384,
			auto_refreshed_at TEXT,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);
	`);

	// Performance indexes
	db.exec(`CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type);`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_sources_category ON sources(category);`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_sources_file_path ON sources(file_path);`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_sources_content_hash ON sources(content_hash);`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_solutions_problem ON solutions(problem_type);`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_solutions_severity ON solutions(severity);`);
}
