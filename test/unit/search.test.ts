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
	porterSearch,
	trigramSearch,
	rrf,
	proximityRerank,
	search,
	type SearchResult,
} from "../../src/store/search.ts";

function createTestDB(): { db: Database.Database; cleanup: () => void } {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-recall-search-"));
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

test("porterSearch returns ranked results", () => {
	const { db, cleanup } = createTestDB();
	try {
		indexContent(db, "s1", "Auth Token", "Token refresh fails silently", "bug");
		indexContent(db, "s2", "CSS Bug", "Flexbox alignment issue", "bug");

		const results = porterSearch(db, "token refresh", 10);
		assert.ok(results.length > 0);
		assert.equal(results[0]!.id, "s1");
	} finally {
		cleanup();
	}
});

test("trigramSearch finds exact substrings", () => {
	const { db, cleanup } = createTestDB();
	try {
		indexContent(db, "s1", "Test", "authentication_token_refresh_failed", "bug");

		const results = trigramSearch(db, "token_refresh", 10);
		assert.ok(results.length > 0);
	} finally {
		cleanup();
	}
});

test("porterSearch returns empty for no matches", () => {
	const { db, cleanup } = createTestDB();
	try {
		const results = porterSearch(db, "nonexistent_query_xyz", 10);
		assert.equal(results.length, 0);
	} finally {
		cleanup();
	}
});

test("rrf merges porter and trigram results correctly", () => {
	const porter: SearchResult[] = [
		{ id: "a", score: 1, title: "A", content: "content a", category: "bug" },
		{ id: "b", score: 0.5, title: "B", content: "content b", category: "bug" },
	];
	const trigram: SearchResult[] = [
		{ id: "b", score: 0.8, title: "", content: "content b", category: "" },
		{ id: "c", score: 0.3, title: "", content: "content c", category: "" },
	];

	const fused = rrf(porter, trigram, 60);

	// "b" appears in both → highest score
	assert.equal(fused[0]!.id, "b");
	assert.ok(fused.length === 3);
});

test("rrf with empty inputs returns empty", () => {
	assert.deepEqual(rrf([], [], 60), []);
});

test("proximityRerank boosts results with nearby terms", () => {
	const results: SearchResult[] = [
		{ id: "1", score: 1, title: "", content: "token cache refresh auth", category: "" },
		{ id: "2", score: 1, title: "", content: "token ... many words ... cache ... many words ... refresh", category: "" },
	];

	const reranked = proximityRerank(results, "token cache refresh");

	// First result has terms closer together → should be boosted higher
	assert.ok(reranked[0]!.score >= reranked[1]!.score);
});

test("proximityRerank with single query term returns results unchanged", () => {
	const results: SearchResult[] = [
		{ id: "1", score: 1, title: "", content: "hello world", category: "" },
	];

	const reranked = proximityRerank(results, "hello");
	assert.equal(reranked.length, 1);
	assert.equal(reranked[0]!.score, 1);
});

test("search integrates porter, trigram, RRF, and proximity", () => {
	const { db, cleanup } = createTestDB();
	try {
		indexContent(db, "s1", "Auth Token Bug", "Token refresh fails silently when cache is stale", "bug");
		indexContent(db, "s2", "Cache Strategy", "Clear cache on token refresh to prevent stale data", "knowledge");

		const results = search(db, "token cache refresh", { maxResults: 5 });
		assert.ok(results.length > 0);
		// Both should be found since both mention token/cache/refresh
		assert.ok(results.length <= 5);
	} finally {
		cleanup();
	}
});

test("search respects scope filter", () => {
	const { db, cleanup } = createTestDB();
	try {
		indexContent(db, "s1", "Auth Bug", "Token refresh fails", "bug");
		indexContent(db, "s2", "Convention", "Use tabs for indentation", "convention");

		const results = search(db, "refresh", { scope: "convention" });
		assert.equal(results.length, 0);
	} finally {
		cleanup();
	}
});
