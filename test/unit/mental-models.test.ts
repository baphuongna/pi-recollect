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
	autoSeedModels,
	getMentalModel,
	refreshMentalModel,
	listMentalModels,
	renderMentalModel,
	type MentalModel,
} from "../../src/memory/mental-models.ts";

function createTestDB(): { db: Database.Database; cleanup: () => void } {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-recall-models-"));
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

test("autoSeedModels creates default models", () => {
	const { db, cleanup } = createTestDB();
	try {
		const created = autoSeedModels(db);
		assert.ok(created >= 4); // 4 default seeds

		const models = listMentalModels(db);
		assert.ok(models.length >= 4);
		assert.ok(models.some((m) => m.name === "architecture"));
		assert.ok(models.some((m) => m.name === "testing-strategy"));
		assert.ok(models.some((m) => m.name === "data-flow"));
		assert.ok(models.some((m) => m.name === "conventions"));
	} finally {
		cleanup();
	}
});

test("autoSeedModels is idempotent", () => {
	const { db, cleanup } = createTestDB();
	try {
		const first = autoSeedModels(db);
		const second = autoSeedModels(db);
		assert.ok(second === 0, "Should not create duplicates");
	} finally {
		cleanup();
	}
});

test("autoSeedModels with custom seeds", () => {
	const { db, cleanup } = createTestDB();
	try {
		const created = autoSeedModels(db, ["architecture"]);
		assert.equal(created, 1);

		const models = listMentalModels(db);
		assert.equal(models.length, 1);
		assert.equal(models[0]!.name, "architecture");
	} finally {
		cleanup();
	}
});

test("getMentalModel returns null for non-existent", () => {
	const { db, cleanup } = createTestDB();
	try {
		assert.equal(getMentalModel(db, "nonexistent"), null);
	} finally {
		cleanup();
	}
});

test("getMentalModel returns seeded model", () => {
	const { db, cleanup } = createTestDB();
	try {
		autoSeedModels(db, ["architecture"]);
		const model = getMentalModel(db, "architecture");
		assert.ok(model);
		assert.equal(model!.name, "architecture");
		assert.ok(model!.content.length > 0);
	} finally {
		cleanup();
	}
});

test("refreshMentalModel updates content from search", () => {
	const { db, cleanup } = createTestDB();
	try {
		autoSeedModels(db, ["architecture"]);
		indexContent(db, "s1", "Auth System", "JWT authentication with refresh tokens", "architecture");

		const result = refreshMentalModel(db, "architecture");
		assert.equal(result, true);

		const model = getMentalModel(db, "architecture");
		assert.ok(model);
		assert.ok(model!.autoRefreshedAt !== null);
	} finally {
		cleanup();
	}
});

test("refreshMentalModel returns false for non-existent", () => {
	const { db, cleanup } = createTestDB();
	try {
		assert.equal(refreshMentalModel(db, "nonexistent"), false);
	} finally {
		cleanup();
	}
});

test("renderMentalModel produces correct XML", () => {
	const model: MentalModel = {
		id: "test",
		name: "data-flow",
		content: "Request → Router → Controller → Service",
		sourceIds: [],
		budgetChars: 16384,
		autoRefreshedAt: null,
		createdAt: "2026-05-11T00:00:00.000Z",
		updatedAt: "2026-05-11T00:00:00.000Z",
	};

	const rendered = renderMentalModel(model);
	assert.ok(rendered.includes('<mental_model name="data-flow"'));
	assert.ok(rendered.includes("Request → Router → Controller → Service"));
	assert.ok(rendered.endsWith("</mental_model>"));
});
