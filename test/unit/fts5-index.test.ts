import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import BetterSqlite3 from "better-sqlite3";
import type Database from "better-sqlite3";
import { initSchema } from "../../src/store/schema.ts";
import { indexContent, removeFromIndex } from "../../src/store/fts5-index.ts";

function createTestDB(): { db: Database.Database; cleanup: () => void } {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-recall-fts5-"));
	const db = new BetterSqlite3(path.join(dir, "test.db")) as unknown as Database.Database;
	initSchema(db);
	return {
		db,
		cleanup: () => {
			db.close();
			fs.rmSync(dir, { recursive: true, force: true });
		},
	};
}

test("indexContent inserts into both chunks and chunks_trigram", () => {
	const { db, cleanup } = createTestDB();
	try {
		indexContent(db, "src-1", "Test Title", "Hello world this is content", "knowledge");

		const porterResults = db.prepare(`SELECT * FROM chunks WHERE source_id = ?`).all("src-1");
		assert.equal(porterResults.length, 1);

		const trigramResults = db.prepare(`SELECT * FROM chunks_trigram WHERE source_id = ?`).all("src-1");
		assert.equal(trigramResults.length, 1);
	} finally {
		cleanup();
	}
});

test("porter stemmer search finds stemmed content", () => {
	const { db, cleanup } = createTestDB();
	try {
		indexContent(db, "s1", "Running tests", "Running tests for authentication", "knowledge");
		indexContent(db, "s2", "Authentication system", "The auth system uses JWT tokens", "architecture");

		// Porter stemmer should match "running" when searching "run"
		const results = db.prepare(
			`SELECT source_id FROM chunks WHERE chunks MATCH ? ORDER BY bm25(chunks)`,
		).all("run") as Array<{ source_id: string }>;

		assert.ok(results.length > 0);
		assert.ok(results.some((r) => r.source_id === "s1"));
	} finally {
		cleanup();
	}
});

test("trigram search finds exact substrings", () => {
	const { db, cleanup } = createTestDB();
	try {
		indexContent(db, "s1", "Test", "authentication_token_refresh_failed", "bug");

		// Trigram should find exact substring
		const trigramQuery = `"token_refresh"`;
		const results = db.prepare(
			`SELECT source_id FROM chunks_trigram WHERE chunks_trigram MATCH ?`,
		).all(trigramQuery) as Array<{ source_id: string }>;

		assert.ok(results.length > 0);
		assert.equal(results[0]!.source_id, "s1");
	} finally {
		cleanup();
	}
});

test("removeFromIndex removes content from both tables", () => {
	const { db, cleanup } = createTestDB();
	try {
		indexContent(db, "s1", "Test", "Some content to remove", "knowledge");
		removeFromIndex(db, "s1");

		const porter = db.prepare(`SELECT * FROM chunks WHERE source_id = ?`).all("s1");
		assert.equal(porter.length, 0);

		const trigram = db.prepare(`SELECT * FROM chunks_trigram WHERE source_id = ?`).all("s1");
		assert.equal(trigram.length, 0);
	} finally {
		cleanup();
	}
});

test("indexing multiple entries and searching finds all", () => {
	const { db, cleanup } = createTestDB();
	try {
		indexContent(db, "s1", "Auth Bug", "Token refresh fails silently on expiry", "bug");
		indexContent(db, "s2", "Auth Fix", "Clear token cache on refresh", "knowledge");
		indexContent(db, "s3", "CSS Issue", "Flexbox alignment problem in Safari", "bug");

		const results = db.prepare(
			`SELECT source_id FROM chunks WHERE chunks MATCH ? ORDER BY bm25(chunks)`,
		).all("token") as Array<{ source_id: string }>;

		assert.ok(results.length >= 2);
		const ids = results.map((r) => r.source_id);
		assert.ok(ids.includes("s1"));
		assert.ok(ids.includes("s2"));
	} finally {
		cleanup();
	}
});
