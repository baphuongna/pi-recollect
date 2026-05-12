import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import BetterSqlite3 from "better-sqlite3";
import type Database from "better-sqlite3";
import { initSchema } from "../../src/store/schema.ts";
import { logEvent, getSessionEvents, getRecentEvents, getEventsByType, pruneOldEvents } from "../../src/store/events.ts";
import { routeFinding, routeSessionFindings } from "../../src/compound/router.ts";
import { extractBugSolution, extractDecision, extractKnowledge } from "../../src/compound/extractor.ts";
import type { SessionEvent } from "../../src/store/events.ts";

function createTestDB(): { db: Database.Database; cleanup: () => void } {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-recall-compound-"));
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

// ── Router tests ───────────────────────────────────────────────────────────────

test("routeFinding returns null for empty events", () => {
	assert.equal(routeFinding([]), null);
});

test("routeFinding classifies error+success+edit as bug", () => {
	const events = [
		{ id: 1, session_id: "s1", type: "error", data: '{"errorMessage":"test error"}', timestamp: new Date().toISOString() },
		{ id: 2, session_id: "s1", type: "command_success", data: '{"output_summary":"fixed"}', timestamp: new Date().toISOString() },
		{ id: 3, session_id: "s1", type: "file_edit", data: '{"file":"test.ts"}', timestamp: new Date().toISOString() },
	];
	const result = routeFinding(events);
	assert.ok(result);
	assert.equal(result!.type, "bug");
	assert.ok(result!.confidence >= 0.8);
});

test("routeFinding classifies user_decision as decision", () => {
	const events = [
		{ id: 1, session_id: "s1", type: "user_decision", data: '{"message":"use SQLite"}', timestamp: new Date().toISOString() },
	];
	const result = routeFinding(events);
	assert.ok(result);
	assert.equal(result!.type, "decision");
});

test("routeFinding classifies file_edit only as knowledge", () => {
	const events = [
		{ id: 1, session_id: "s1", type: "file_edit", data: '{"file":"src/app.ts"}', timestamp: new Date().toISOString() },
	];
	const result = routeFinding(events);
	assert.ok(result);
	assert.equal(result!.type, "knowledge");
});

test("routeSessionFindings groups events by type", () => {
	const events = [
		{ id: 1, session_id: "s1", type: "error", data: '{"errorMessage":"fail"}', timestamp: new Date().toISOString() },
		{ id: 2, session_id: "s1", type: "command_success", data: '{"output_summary":"ok"}', timestamp: new Date().toISOString() },
		{ id: 3, session_id: "s1", type: "user_decision", data: '{"message":"decided X"}', timestamp: new Date().toISOString() },
	];
	const findings = routeSessionFindings(events);
	assert.ok(findings.length >= 1);
});

// ── Extractor tests ────────────────────────────────────────────────────────────

test("extractBugSolution extracts from error event", () => {
	const errorEvent: SessionEvent = {
		id: 1, session_id: "s1", type: "error",
		data: JSON.stringify({ errorMessage: "Token refresh failed", tool: "bash" }),
		timestamp: new Date().toISOString(),
	};
	const result = extractBugSolution(errorEvent, null);
	assert.ok(result);
	assert.equal(result!.type, "bug");
	assert.ok(result!.problem.includes("Token refresh failed"));
	assert.equal(result!.tags.includes("bash"), true);
});

test("extractBugSolution returns null for unparseable data", () => {
	const errorEvent: SessionEvent = {
		id: 1, session_id: "s1", type: "error",
		data: "not json",
		timestamp: new Date().toISOString(),
	};
	assert.equal(extractBugSolution(errorEvent, null), null);
});

test("extractDecision extracts from user_decision event", () => {
	const event: SessionEvent = {
		id: 1, session_id: "s1", type: "user_decision",
		data: JSON.stringify({ message_summary: "Use SQLite for local storage" }),
		timestamp: new Date().toISOString(),
	};
	const result = extractDecision(event);
	assert.ok(result);
	assert.equal(result!.type, "decision");
	assert.ok(result!.context.includes("SQLite"));
});

test("extractKnowledge extracts from file_edit events", () => {
	const events: SessionEvent[] = [
		{ id: 1, session_id: "s1", type: "file_edit", data: JSON.stringify({ file: "src/app.ts" }), timestamp: new Date().toISOString() },
		{ id: 2, session_id: "s1", type: "file_edit", data: JSON.stringify({ file: "src/util.ts" }), timestamp: new Date().toISOString() },
	];
	const result = extractKnowledge(events);
	assert.ok(result);
	assert.equal(result!.type, "knowledge");
	assert.deepEqual(result!.files, ["src/app.ts", "src/util.ts"]);
});

test("extractKnowledge returns null for empty events", () => {
	assert.equal(extractKnowledge([]), null);
});
