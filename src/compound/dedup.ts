import type Database from "better-sqlite3";
import { porterSearch } from "../store/search.ts";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface OverlapAssessment {
	problemOverlap: number;
	rootCauseOverlap: number;
	solutionOverlap: number;
	filesOverlap: number;
	preventionOverlap: number;
}

export interface SolutionForDedup {
	title: string;
	content: string;
	files: string[];
	tags: string[];
}

// ── Overlap assessment ─────────────────────────────────────────────────────────

/**
 * Compute text similarity between two strings using simple token overlap.
 */
function textSimilarity(a: string, b: string): number {
	const tokenize = (s: string): Set<string> =>
		new Set(s.toLowerCase().split(/\s+/).filter((t) => t.length > 2));
	const setA = tokenize(a);
	const setB = tokenize(b);
	if (setA.size === 0 && setB.size === 0) return 1;
	if (setA.size === 0 || setB.size === 0) return 0;
	let intersection = 0;
	for (const token of setA) {
		if (setB.has(token)) intersection++;
	}
	const union = setA.size + setB.size - intersection;
	return union > 0 ? intersection / union : 0;
}

/**
 * Compute file set overlap (Jaccard similarity).
 */
function fileOverlap(filesA: string[], filesB: string[]): number {
	if (filesA.length === 0 && filesB.length === 0) return 0;
	if (filesA.length === 0 || filesB.length === 0) return 0;
	const setA = new Set(filesA);
	const setB = new Set(filesB);
	let intersection = 0;
	for (const f of setA) {
		if (setB.has(f)) intersection++;
	}
	const union = setA.size + setB.size - intersection;
	return union > 0 ? intersection / union : 0;
}

/**
 * Assess overlap between a new solution and an existing solution.
 * Uses token-based text similarity + file set intersection.
 */
export function assessOverlap(
	newSol: SolutionForDedup,
	existingSol: SolutionForDedup,
): OverlapAssessment {
	return {
		problemOverlap: textSimilarity(newSol.title, existingSol.title),
		rootCauseOverlap: textSimilarity(
			newSol.content.slice(0, 500),
			existingSol.content.slice(0, 500),
		),
		solutionOverlap: textSimilarity(newSol.content, existingSol.content),
		filesOverlap: fileOverlap(newSol.files, existingSol.files),
		preventionOverlap: textSimilarity(
			newSol.tags.join(" "),
			existingSol.tags.join(" "),
		),
	};
}

/**
 * Determine if two solutions are duplicates using weighted 5-dimension check.
 */
export function shouldDedup(overlap: OverlapAssessment, threshold: number = 0.7): boolean {
	const weighted =
		overlap.problemOverlap * 0.3 +
		overlap.rootCauseOverlap * 0.3 +
		overlap.solutionOverlap * 0.2 +
		overlap.filesOverlap * 0.1 +
		overlap.preventionOverlap * 0.1;
	return weighted > threshold;
}

/**
 * Find potential duplicates in the database using FTS5 search.
 */
export function findPotentialDuplicates(
	db: Database.Database,
	title: string,
): Array<{ id: string; title: string; content: string; files: string; tags: string }> {
	try {
		const results = porterSearch(db, title, 5);
		const ids = results.map((r) => r.id);
		if (ids.length === 0) return [];
		const placeholders = ids.map(() => "?").join(",");
		return db.prepare(
			`SELECT id, title, content, files, tags FROM solutions WHERE id IN (${placeholders})`,
		).all(...ids) as Array<{ id: string; title: string; content: string; files: string; tags: string }>;
	} catch {
		return [];
	}
}
