import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import BetterSqlite3 from "better-sqlite3";
import type Database from "better-sqlite3";
import { initSchema } from "../../src/store/schema.ts";
import { indexContent } from "../../src/store/fts5-index.ts";
import {
	recallMemories,
	wrapInAntiFeedbackTags,
	budgetToDetailLevel,
	type DetailLevel,
} from "../../src/memory/recall.ts";

function createTestDB(): { db: Database.Database; cleanup: () => void } {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-recall-recall-"));
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

test("wrapInAntiFeedbackTags wraps content correctly", () => {
	const result = wrapInAntiFeedbackTags("test memory content");
	assert.ok(result.startsWith("<memories>"));
	assert.ok(result.endsWith("</memories>"));
	assert.ok(result.includes("background knowledge"));
	assert.ok(result.includes("test memory content"));
});

test("wrapInAntiFeedbackTags returns empty for empty content", () => {
	const result = wrapInAntiFeedbackTags("");
	assert.equal(result, "");
});

test("wrapInAntiFeedbackTags returns empty for whitespace-only content", () => {
	const result = wrapInAntiFeedbackTags("   ");
	assert.equal(result, "");
});

test("budgetToDetailLevel returns correct levels", () => {
	assert.equal(budgetToDetailLevel(100), "compact");
	assert.equal(budgetToDetailLevel(2047), "compact");
	assert.equal(budgetToDetailLevel(2048), "medium");
	assert.equal(budgetToDetailLevel(3000), "medium");
	assert.equal(budgetToDetailLevel(10240), "full");
	assert.equal(budgetToDetailLevel(50000), "full");
});

test("recallMemories returns empty result for empty DB", () => {
	const { db, cleanup } = createTestDB();
	try {
		const result = recallMemories(db, "anything", 2048);
		assert.equal(result.resultCount, 0);
		assert.equal(result.detailLevel, "medium");
		assert.ok(result.content.includes("No stored memories"));
	} finally {
		cleanup();
	}
});

test("recallMemories with compact budget returns short format", () => {
	const { db, cleanup } = createTestDB();
	try {
		indexContent(db, "s1", "Auth Bug", "Token refresh fails silently on cache expiry", "bug");
		const result = recallMemories(db, "token refresh", 1000);
		assert.equal(result.detailLevel, "compact");
		assert.ok(result.resultCount > 0);
	} finally {
		cleanup();
	}
});

test("recallMemories with medium budget returns preview format", () => {
	const { db, cleanup } = createTestDB();
	try {
		indexContent(db, "s1", "Auth Bug", "Token refresh fails silently on cache expiry", "bug");
		const result = recallMemories(db, "token refresh", 5000);
		assert.equal(result.detailLevel, "medium");
		assert.ok(result.content.includes("Auth Bug"));
	} finally {
		cleanup();
	}
});

test("recallMemories with large budget returns full format", () => {
	const { db, cleanup } = createTestDB();
	try {
		indexContent(db, "s1", "Auth Bug", "Token refresh fails silently on cache expiry", "bug");
		const result = recallMemories(db, "token refresh", 20000);
		assert.equal(result.detailLevel, "full");
		assert.ok(result.content.includes("Token refresh"));
	} finally {
		cleanup();
	}
});
