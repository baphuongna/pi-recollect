import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig, DEFAULT_CONFIG, type PiMemoryConfig } from "../../src/config.ts";

function withTempConfig(configObj: Record<string, unknown>, fn: (dir: string) => void): void {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-recall-config-"));
	const piDir = path.join(dir, ".pi");
	fs.mkdirSync(piDir, { recursive: true });
	fs.writeFileSync(path.join(piDir, "pi-recollect.json"), JSON.stringify(configObj));
	try {
		fn(dir);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

test("loadConfig returns defaults when no config file exists", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-recall-config-"));
	try {
		const config = loadConfig(dir);
		assert.deepEqual(config, DEFAULT_CONFIG);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("loadConfig merges partial config with defaults", () => {
	withTempConfig({ enabled: false, recallBudget: 4096 }, (dir) => {
		const config = loadConfig(dir);
		assert.equal(config.enabled, false);
		assert.equal(config.recallBudget, 4096);
		// Defaults should still be present
		assert.equal(config.search.maxResults, 5);
		assert.equal(config.compounding.dedupThreshold, 0.7);
	});
});

test("loadConfig merges nested objects", () => {
	withTempConfig({
		search: { maxResults: 10 },
		mentalModels: { enabled: false },
	}, (dir) => {
		const config = loadConfig(dir);
		assert.equal(config.search.maxResults, 10);
		assert.equal(config.search.rrfK, 60); // default preserved
		assert.equal(config.mentalModels.enabled, false);
		assert.equal(config.mentalModels.budgetChars, 16384); // default preserved
	});
});

test("loadConfig handles malformed JSON gracefully", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-recall-config-"));
	const piDir = path.join(dir, ".pi");
	fs.mkdirSync(piDir, { recursive: true });
	fs.writeFileSync(path.join(piDir, "pi-recollect.json"), "not valid json {{{");
	try {
		const config = loadConfig(dir);
		assert.deepEqual(config, DEFAULT_CONFIG);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("loadConfig handles non-object JSON gracefully", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-recall-config-"));
	const piDir = path.join(dir, ".pi");
	fs.mkdirSync(piDir, { recursive: true });
	fs.writeFileSync(path.join(piDir, "pi-recollect.json"), "42");
	try {
		const config = loadConfig(dir);
		assert.deepEqual(config, DEFAULT_CONFIG);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("DEFAULT_CONFIG has all expected fields", () => {
	assert.equal(typeof DEFAULT_CONFIG.enabled, "boolean");
	assert.equal(typeof DEFAULT_CONFIG.autoCompound, "boolean");
	assert.equal(typeof DEFAULT_CONFIG.recallBudget, "number");
	assert.ok(Array.isArray(DEFAULT_CONFIG.mentalModels.seeds));
	assert.ok(DEFAULT_CONFIG.mentalModels.seeds.length >= 4);
	assert.equal(typeof DEFAULT_CONFIG.search.rrfK, "number");
	assert.equal(typeof DEFAULT_CONFIG.compounding.dedupThreshold, "number");
});
