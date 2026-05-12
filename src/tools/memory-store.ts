import type Database from "better-sqlite3";
import { storeMemory, type StoreMemoryOpts } from "../memory/retain.ts";

export interface MemoryStoreInput {
	category: "gotcha" | "convention" | "decision" | "pattern" | "architecture";
	title: string;
	content: string;
	metadata?: {
		files?: string[];
		tags?: string[];
		severity?: "low" | "medium" | "high" | "critical";
	};
}

/**
 * Handle the memory_store tool invocation.
 */
export function handleMemoryStore(db: Database.Database, cwd: string, input: MemoryStoreInput): string {
	const opts: StoreMemoryOpts = {
		category: input.category,
		title: input.title,
		content: input.content,
		files: input.metadata?.files,
		tags: input.metadata?.tags,
		severity: input.metadata?.severity,
	};

	const id = storeMemory(db, cwd, opts);
	return `Stored memory "${input.title}" (${input.category}) with id ${id}.`;
}
