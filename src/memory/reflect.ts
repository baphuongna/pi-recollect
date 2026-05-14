import type Database from "better-sqlite3";
import { pruneOldEvents } from "../store/events.ts";
import { recordAudit } from "../store/audit-log.ts";
import { autoSeedModels, refreshMentalModel, listMentalModels } from "./mental-models.ts";
import { cascadeUpdate, type CascadeResult } from "../graph/cascade.ts";

export interface ConsolidationResult {
	prunedEvents: number;
	refreshedModels: number;
	cascadeResults: CascadeResult[];
}

/**
 * Consolidate memories: prune old events, refresh stale mental models, cascade-update stale graph nodes.
 */
export function consolidateMemories(
	db: Database.Database,
	maxAgeDays: number = 90,
	graphStore?: { query: (filter: object) => { id: string; stale?: boolean; relations: { targetId: string }[] }[]; updateNode: (id: string, updates: object) => { id: string } | undefined },
): ConsolidationResult {
	// Audit bulk event pruning before it runs (pruneOldEvents calls recordAudit internally, but we
	// also emit a top-level entry so callers know consolidateMemories triggered the sweep)
	recordAudit(db, "delete", "consolidateMemories", [], { type: "event_prune", maxAgeDays });

	// Prune old events
	const prunedEvents = pruneOldEvents(db, maxAgeDays);

	// Refresh stale mental models
	let refreshedModels = 0;
	const models = listMentalModels(db);
	for (const model of models) {
		// Refresh if never refreshed or if stale (>3 sessions without update)
		if (!model.autoRefreshedAt) {
			refreshMentalModel(db, model.name);
			refreshedModels++;
		}
	}

	// Cascade-update: find superseded memory entries and mark stale graph nodes
	const cascadeResults: CascadeResult[] = [];
	if (graphStore) {
		// Query for superseded entries (status = 'superseded' from the sources table)
		const supersededRows = db.prepare(`
			SELECT id FROM sources WHERE status = 'superseded' AND type = 'memory'
		`).all() as { id: string }[];
		for (const row of supersededRows) {
			const result = cascadeUpdate(graphStore as Parameters<typeof cascadeUpdate>[0], row.id);
			if (result.flagged > 0) {
				cascadeResults.push(result);
			}
		}
	}

	return { prunedEvents, refreshedModels, cascadeResults };
}