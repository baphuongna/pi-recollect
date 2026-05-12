import * as crypto from "node:crypto";
import type Database from "better-sqlite3";
import { search } from "../store/search.ts";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MentalModel {
	id: string;
	name: string;
	content: string;
	sourceIds: string[];
	budgetChars: number;
	autoRefreshedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

// ── Seeds ──────────────────────────────────────────────────────────────────────

const SEEDS = [
	{ name: "architecture", description: "Project structure and key components" },
	{ name: "testing-strategy", description: "How tests are organized and run" },
	{ name: "data-flow", description: "How data moves through the system" },
	{ name: "conventions", description: "Coding style and patterns used" },
];

/**
 * Auto-create mental models for common categories if they don't exist yet.
 */
export function autoSeedModels(db: Database.Database, seeds?: string[]): number {
	let created = 0;
	const seedsToUse = seeds ?? SEEDS.map((s) => s.name);
	for (const seedName of seedsToUse) {
		const seed = SEEDS.find((s) => s.name === seedName);
		if (!seed) continue;
		const existing = db.prepare(`SELECT 1 FROM mental_models WHERE name = ?`).get(seedName);
		if (!existing) {
			const id = crypto.randomUUID();
			const now = new Date().toISOString();
			db.prepare(`
				INSERT INTO mental_models (id, name, content, source_ids, budget_chars, created_at, updated_at)
				VALUES (?, ?, ?, '[]', 16384, ?, ?)
			`).run(id, seedName, seed.description, now, now);
			created++;
		}
	}
	return created;
}

/**
 * Get a mental model by name.
 */
export function getMentalModel(db: Database.Database, name: string): MentalModel | null {
	const row = db.prepare(`SELECT * FROM mental_models WHERE name = ?`).get(name) as {
		id: string;
		name: string;
		content: string;
		source_ids: string | null;
		budget_chars: number;
		auto_refreshed_at: string | null;
		created_at: string;
		updated_at: string;
	} | undefined;
	if (!row) return null;
	return {
		id: row.id,
		name: row.name,
		content: row.content,
		sourceIds: row.source_ids ? JSON.parse(row.source_ids) as string[] : [],
		budgetChars: row.budget_chars,
		autoRefreshedAt: row.auto_refreshed_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

/**
 * Refresh a mental model by searching for related content and updating it.
 */
export function refreshMentalModel(db: Database.Database, name: string): boolean {
	const model = getMentalModel(db, name);
	if (!model) return false;

	// Search for related content
	const results = search(db, name, { maxResults: 10 });

	// Build updated content from search results
	const lines = results.map((r) => `- **${r.title}**: ${r.content.slice(0, 200)}`);
	const newContent = lines.length > 0 ? lines.join("\n") : model.content;

	// Truncate to budget
	const truncated = newContent.length > model.budgetChars
		? newContent.slice(0, model.budgetChars) + "\n[... truncated, see full source ...]"
		: newContent;

	const now = new Date().toISOString();
	const sourceIds = JSON.stringify(results.map((r) => r.id));

	db.prepare(`
		UPDATE mental_models SET content = ?, source_ids = ?, auto_refreshed_at = ?, updated_at = ?
		WHERE id = ?
	`).run(truncated, sourceIds, now, now, model.id);

	return true;
}

/**
 * List all mental models.
 */
export function listMentalModels(db: Database.Database): MentalModel[] {
	const rows = db.prepare(`SELECT * FROM mental_models ORDER BY name`).all() as Array<{
		id: string;
		name: string;
		content: string;
		source_ids: string | null;
		budget_chars: number;
		auto_refreshed_at: string | null;
		created_at: string;
		updated_at: string;
	}>;
	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		content: row.content,
		sourceIds: row.source_ids ? JSON.parse(row.source_ids) as string[] : [],
		budgetChars: row.budget_chars,
		autoRefreshedAt: row.auto_refreshed_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}));
}

/**
 * Render a mental model in XML tag format for context injection.
 */
export function renderMentalModel(model: MentalModel): string {
	const updated = model.updatedAt.split("T")[0];
	return `<mental_model name="${model.name}" updated="${updated}">
${model.content}
</mental_model>`;
}
