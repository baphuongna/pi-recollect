import type Database from "better-sqlite3";

export interface VocabStats {
	docCount: number;
	totalCount: number;
}

/**
 * Update vocabulary term frequencies for a list of terms.
 * Increments doc_count (unique docs) and total_count (total occurrences).
 */
export function updateVocabulary(db: Database.Database, terms: string[]): void {
	const upsert = db.prepare(`
		INSERT INTO vocabulary (term, doc_count, total_count)
		VALUES (?, 1, 1)
		ON CONFLICT(term) DO UPDATE SET
			doc_count = doc_count + 1,
			total_count = total_count + 1
	`);
	for (const term of terms) {
		upsert.run(term.toLowerCase());
	}
}

/**
 * Get vocabulary statistics for a specific term.
 */
export function getVocabStats(db: Database.Database, term: string): VocabStats | null {
	const row = db.prepare(
		`SELECT doc_count, total_count FROM vocabulary WHERE term = ?`,
	).get(term.toLowerCase()) as { doc_count: number; total_count: number } | undefined;
	if (!row) return null;
	return { docCount: row.doc_count, totalCount: row.total_count };
}
