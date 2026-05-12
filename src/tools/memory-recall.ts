import type Database from "better-sqlite3";
import { recallMemories, wrapInAntiFeedbackTags } from "../memory/recall.ts";

export interface MemoryRecallInput {
	context: string;
	budget?: number;
}

/**
 * Handle the memory_recall tool invocation.
 */
export function handleMemoryRecall(db: Database.Database, input: MemoryRecallInput): string {
	const budget = input.budget ?? 2048;
	const result = recallMemories(db, input.context, budget);
	const wrapped = wrapInAntiFeedbackTags(result.content);
	return `Recalled ${result.resultCount} memories (detail: ${result.detailLevel}, budget: ${budget} bytes):\n\n${wrapped}`;
}
