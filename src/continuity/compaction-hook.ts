import type Database from "better-sqlite3";
import { recallMemories, wrapInAntiFeedbackTags } from "../memory/recall.ts";
import { logEvent } from "../store/events.ts";

export interface CompactionContext {
	taskDescription: string;
	compactionEntry?: string;
}

/**
 * Handle the preCompactionContext hook.
 * When Pi compacts the context window, recall relevant memories to preserve
 * important information that was shed.
 */
export function handleCompaction(
	db: Database.Database,
	sessionId: string,
	context: CompactionContext,
	budget: number = 2048,
): string {
	// Log the compaction event
	logEvent(db, sessionId, "compaction", {
		taskDescription: context.taskDescription,
		timestamp: new Date().toISOString(),
	});

	// Recall relevant memories for the current task
	const result = recallMemories(db, context.taskDescription, budget);

	// Wrap in anti-feedback tags and return
	return wrapInAntiFeedbackTags(result.content);
}
