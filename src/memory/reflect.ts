import type Database from "better-sqlite3";
import { pruneOldEvents } from "../store/events.ts";
import { autoSeedModels, refreshMentalModel, listMentalModels } from "./mental-models.ts";

export interface ConsolidationResult {
	prunedEvents: number;
	refreshedModels: number;
}

/**
 * Consolidate memories: prune old events, refresh stale mental models.
 */
export function consolidateMemories(
	db: Database.Database,
	maxAgeDays: number = 90,
): ConsolidationResult {
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

	return { prunedEvents, refreshedModels };
}
