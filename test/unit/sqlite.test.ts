import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { MemoryDB } from "../../src/store/sqlite.ts";
import { initSchema } from "../../src/store/schema.ts";
import BetterSqlite3 from "better-sqlite3";
import type Database from "better-sqlite3";

function createTempDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "pi-recall-test-"));
}

function createTestDB(): { db: Database.Database; dir: string; cleanup: () => void } {
	const dir = createTempDir();
	const dbPath = path.join(dir, "test.db");
	const db = new BetterSqlite3(dbPath) as unknown as Database.Database;
	initSchema(db);
	return {
		db,
		dir,
		cleanup: () => {
			db.close();
			fs.rmSync(dir, { recursive: true, force: true });
		},
	};
}

test("MemoryDB creates .pi-recall directory and opens database", () => {
	const dir = createTempDir();
	try {
		const memDB = new MemoryDB(dir);
		assert.ok(!memDB.isOpen);
		const conn = memDB.open();
		assert.ok(memDB.isOpen);
		assert.ok(fs.existsSync(path.join(dir, ".pi-recall")));
		assert.ok(fs.existsSync(path.join(dir, ".pi-recall", "memory.db")));
		memDB.close();
		assert.ok(!memDB.isOpen);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("MemoryDB getConnection throws if not opened", () => {
	const dir = createTempDir();
	try {
		const memDB = new MemoryDB(dir);
		assert.throws(() => memDB.getConnection(), /not opened/i);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("MemoryDB returns same connection on repeated open calls", () => {
	const dir = createTempDir();
	try {
		const memDB = new MemoryDB(dir);
		const conn1 = memDB.open();
		const conn2 = memDB.open();
		assert.strictEqual(conn1, conn2);
		memDB.close();
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("initSchema creates all expected tables", () => {
	const { db, cleanup } = createTestDB();
	try {
		const tables = db.prepare(
			`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
		).all() as Array<{ name: string }>;
		const tableNames = tables.map((t) => t.name);

		assert.ok(tableNames.includes("sources"), "sources table missing");
		assert.ok(tableNames.includes("vocabulary"), "vocabulary table missing");
		assert.ok(tableNames.includes("events"), "events table missing");
		assert.ok(tableNames.includes("solutions"), "solutions table missing");
		assert.ok(tableNames.includes("mental_models"), "mental_models table missing");
	} finally {
		cleanup();
	}
});

test("initSchema creates FTS5 virtual tables", () => {
	const { db, cleanup } = createTestDB();
	try {
		const tables = db.prepare(
			`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'chunks%' ORDER BY name`,
		).all() as Array<{ name: string }>;
		const tableNames = tables.map((t) => t.name);

		assert.ok(tableNames.includes("chunks"), "chunks FTS5 table missing");
		assert.ok(tableNames.includes("chunks_trigram"), "chunks_trigram FTS5 table missing");
	} finally {
		cleanup();
	}
});

test("initSchema is idempotent — can be called twice safely", () => {
	const { db, cleanup } = createTestDB();
	try {
		assert.doesNotThrow(() => initSchema(db));
	} finally {
		cleanup();
	}
});

test("pragmas are set correctly", () => {
	const { db, cleanup } = createTestDB();
	try {
		const journalMode = (db.pragma("journal_mode") as Array<{ journal_mode: string }>)[0];
		assert.equal(journalMode.journal_mode, "wal");
		const foreignKeys = (db.pragma("foreign_keys") as Array<{ foreign_keys: number }>)[0];
		assert.equal(foreignKeys.foreign_keys, 1);
	} finally {
		cleanup();
	}
});
