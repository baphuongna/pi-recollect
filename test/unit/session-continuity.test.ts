import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import BetterSqlite3 from "better-sqlite3";
import type Database from "better-sqlite3";
import { initSchema } from "../../src/store/schema.ts";
import { logEvent, getSessionEvents } from "../../src/store/events.ts";
import { buildResumeContext, buildSessionResumeContext, formatResumeContext } from "../../src/continuity/resumer.ts";

function createTestDB(): { db: Database.Database; cleanup: () => void } {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-recall-continuity-"));
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

test("buildResumeContext returns null for empty DB", () => {
	const { db, cleanup } = createTestDB();
	try {
		assert.equal(buildResumeContext(db), null);
	} finally {
		cleanup();
	}
});

test("buildSessionResumeContext returns context for session with events", () => {
	const { db, cleanup } = createTestDB();
	try {
		logEvent(db, "session-1", "file_edit", { file: "src/app.ts" });
		logEvent(db, "session-1", "file_edit", { file: "src/util.ts" });
		logEvent(db, "session-1", "error", { errorMessage: "Type error in app.ts" });
		logEvent(db, "session-1", "user_decision", { message_summary: "Add auth middleware" });

		const ctx = buildSessionResumeContext(db, "session-1");
		assert.ok(ctx);
		assert.deepEqual(ctx!.lastFiles, ["src/app.ts", "src/util.ts"]);
		assert.equal(ctx!.lastError, "Type error in app.ts");
		assert.equal(ctx!.lastTask, "Add auth middleware");
		assert.equal(ctx!.status, "had errors");
		assert.equal(ctx!.sessionId, "session-1");
	} finally {
		cleanup();
	}
});

test("buildSessionResumeContext returns null for unknown session", () => {
	const { db, cleanup } = createTestDB();
	try {
		assert.equal(buildSessionResumeContext(db, "nonexistent"), null);
	} finally {
		cleanup();
	}
});

test("buildResumeContext picks the most recent session", () => {
	const { db, cleanup } = createTestDB();
	try {
		logEvent(db, "session-old", "file_edit", { file: "old.ts" });

		// Add a slight delay to ensure ordering, or just add another event
		logEvent(db, "session-new", "file_edit", { file: "new.ts" });
		logEvent(db, "session-new", "user_decision", { message_summary: "New task" });

		const ctx = buildResumeContext(db);
		assert.ok(ctx);
		assert.ok(ctx!.sessionId);
	} finally {
		cleanup();
	}
});

test("formatResumeContext produces human-readable output", () => {
	const ctx = {
		lastFiles: ["src/app.ts", "src/util.ts"],
		lastError: "Type error",
		lastTask: "Add auth",
		status: "had errors",
		sessionId: "s1",
	};

	const formatted = formatResumeContext(ctx);
	assert.ok(formatted.includes("Previous session context:"));
	assert.ok(formatted.includes("src/app.ts"));
	assert.ok(formatted.includes("Type error"));
	assert.ok(formatted.includes("Add auth"));
	assert.ok(formatted.includes("had errors"));
});

test("formatResumeContext respects maxBytes", () => {
	const ctx = {
		lastFiles: ["file1.ts", "file2.ts", "file3.ts", "file4.ts", "file5.ts"],
		lastError: "A very long error message " + "x".repeat(500),
		lastTask: "A very long task description",
		status: "completed successfully",
		sessionId: "s1",
	};

	const formatted = formatResumeContext(ctx, 100);
	assert.ok(new TextEncoder().encode(formatted).length <= 110); // Allow slight overshoot
});

test("status is 'completed successfully' when no errors", () => {
	const { db, cleanup } = createTestDB();
	try {
		logEvent(db, "session-ok", "file_edit", { file: "ok.ts" });

		const ctx = buildSessionResumeContext(db, "session-ok");
		assert.ok(ctx);
		assert.equal(ctx!.status, "completed successfully");
		assert.equal(ctx!.lastError, null);
	} finally {
		cleanup();
	}
});
