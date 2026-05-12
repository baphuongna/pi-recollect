import type Database from "better-sqlite3";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SearchResult {
	id: string;
	score: number;
	title: string;
	content: string;
	category: string;
}

export interface SearchOptions {
	maxResults?: number;
	rrfK?: number;
	proximityBoost?: number;
	scope?: string;
	detail?: "compact" | "medium" | "full";
}

// ── Porter stemmer search ──────────────────────────────────────────────────────

export function porterSearch(
	db: Database.Database,
	query: string,
	limit: number,
): SearchResult[] {
	const sql = `
		SELECT source_id, title, content, category, rank
		FROM chunks
		WHERE chunks MATCH ?
		ORDER BY bm25(chunks)
		LIMIT ?
	`;
	try {
		const rows = db.prepare(sql).all(query, limit) as Array<{
			source_id: string;
			title: string;
			content: string;
			category: string;
			rank: number;
		}>;
		return rows.map((r) => ({
			id: r.source_id,
			score: -r.rank,
			title: r.title ?? "",
			content: r.content ?? "",
			category: r.category ?? "",
		}));
	} catch {
		return [];
	}
}

// ── Trigram search ─────────────────────────────────────────────────────────────

export function trigramSearch(
	db: Database.Database,
	query: string,
	limit: number,
): SearchResult[] {
	// Trigram FTS5 requires wrapping query in quotes for phrase matching
	const trigramQuery = `"${query.replace(/"/g, '""')}"`;
	const sql = `
		SELECT source_id, content, rank
		FROM chunks_trigram
		WHERE chunks_trigram MATCH ?
		ORDER BY bm25(chunks_trigram)
		LIMIT ?
	`;
	try {
		const rows = db.prepare(sql).all(trigramQuery, limit) as Array<{
			source_id: string;
			content: string;
			rank: number;
		}>;
		return rows.map((r) => ({
			id: r.source_id,
			score: -r.rank,
			title: "",
			content: r.content ?? "",
			category: "",
		}));
	} catch {
		return [];
	}
}

// ── Reciprocal Rank Fusion ─────────────────────────────────────────────────────

export function rrf(
	porterResults: SearchResult[],
	trigramResults: SearchResult[],
	K: number = 60,
): SearchResult[] {
	const scores = new Map<string, { score: number; title: string; content: string; category: string }>();

	for (const [rank, result] of porterResults.entries()) {
		const existing = scores.get(result.id);
		const addedScore = 1 / (K + rank + 1);
		if (existing) {
			existing.score += addedScore;
		} else {
			scores.set(result.id, {
				score: addedScore,
				title: result.title,
				content: result.content,
				category: result.category,
			});
		}
	}

	for (const [rank, result] of trigramResults.entries()) {
		const existing = scores.get(result.id);
		const addedScore = 1 / (K + rank + 1);
		if (existing) {
			existing.score += addedScore;
			// Keep porter title if available
			if (!existing.title && result.title) existing.title = result.title;
		} else {
			scores.set(result.id, {
				score: addedScore,
				title: result.title,
				content: result.content,
				category: result.category,
			});
		}
	}

	return [...scores.entries()]
		.sort((a, b) => b[1].score - a[1].score)
		.map(([id, data]) => ({
			id,
			score: data.score,
			title: data.title,
			content: data.content,
			category: data.category,
		}));
}

// ── Proximity reranking ────────────────────────────────────────────────────────

export function proximityRerank(
	results: SearchResult[],
	query: string,
	boost: number = 1.5,
): SearchResult[] {
	const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 0);
	if (terms.length <= 1) return results;

	return results.map((result) => {
		const lower = result.content.toLowerCase();
		const positions: number[][] = terms.map((term) => {
			const pos: number[] = [];
			let idx = 0;
			while (true) {
				const found = lower.indexOf(term, idx);
				if (found === -1) break;
				pos.push(found);
				idx = found + 1;
			}
			return pos;
		});

		// If any term not found, no proximity bonus
		if (positions.some((p) => p.length === 0)) return result;

		// Find minimum span covering one occurrence of each term
		let minSpan = Infinity;
		for (const pos0 of positions[0]!) {
			const current: number[] = [pos0];
			for (let t = 1; t < positions.length; t++) {
				// Find closest position in term t to the last added position
				const lastPos = current[current.length - 1]!;
				let closest = positions[t]![0]!;
				for (const p of positions[t]!) {
					if (Math.abs(p - lastPos) < Math.abs(closest - lastPos)) {
						closest = p;
					}
				}
				current.push(closest);
			}
			const span = Math.max(...current) - Math.min(...current);
			minSpan = Math.min(minSpan, span);
		}

		// Boost inversely proportional to span (closer terms = higher boost)
		const contentLength = Math.max(result.content.length, 1);
		const proximityScore = minSpan < contentLength ? boost * (1 - minSpan / contentLength) : 0;

		return {
			...result,
			score: result.score + proximityScore,
		};
	}).sort((a, b) => b.score - a.score);
}

// ── Unified search ─────────────────────────────────────────────────────────────

export function search(
	db: Database.Database,
	query: string,
	opts: SearchOptions = {},
): SearchResult[] {
	const maxResults = opts.maxResults ?? 5;
	const rrfK = opts.rrfK ?? 60;
	const boost = opts.proximityBoost ?? 1.5;
	const fetchLimit = maxResults * 4; // fetch more for reranking

	const porter = porterSearch(db, query, fetchLimit);
	const trigram = trigramSearch(db, query, fetchLimit);

	let fused = rrf(porter, trigram, rrfK);
	fused = proximityRerank(fused, query, boost);

	// Scope filter
	if (opts.scope && opts.scope !== "all") {
		fused = fused.filter((r) => r.category === opts.scope);
	}

	return fused.slice(0, maxResults);
}
