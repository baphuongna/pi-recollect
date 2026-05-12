import type Database from "better-sqlite3";
import { search, type SearchOptions } from "../store/search.ts";

export interface MemorySearchInput {
	query: string;
	maxResults?: number;
	scope?: "all" | "solutions" | "decisions" | "gotchas" | "conventions";
	detail?: "compact" | "medium" | "full";
}

export interface MemorySearchResult {
	results: Array<{
		title: string;
		content: string;
		category: string;
		score: number;
	}>;
	totalCount: number;
}

function formatResult(title: string, content: string, category: string, score: number, detail: string): string {
	switch (detail) {
		case "compact":
			return `${title} (${category}, score: ${score.toFixed(3)})`;
		case "medium":
			return `${title} (${category}): ${content.slice(0, 200)}`;
		case "full":
			return `## ${title}\nCategory: ${category}\n\n${content}`;
		default:
			return `${title}: ${content.slice(0, 200)}`;
	}
}

/**
 * Handle the memory_search tool invocation.
 */
export function handleMemorySearch(db: Database.Database, input: MemorySearchInput): string {
	const opts: SearchOptions = {
		maxResults: input.maxResults ?? 5,
		scope: input.scope ?? "all",
		detail: input.detail ?? "compact",
	};

	const results = search(db, input.query, opts);

	if (results.length === 0) {
		return `No results found for "${input.query}".`;
	}

	const detail = input.detail ?? "compact";
	const formatted = results
		.map((r) => formatResult(r.title, r.content, r.category, r.score, detail))
		.join("\n\n");

	return `Found ${results.length} result(s) for "${input.query}":\n\n${formatted}`;
}
