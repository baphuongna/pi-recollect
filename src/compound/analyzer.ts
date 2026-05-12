import * as crypto from "node:crypto";
import type Database from "better-sqlite3";
import { getSessionEvents } from "../store/events.ts";
import { routeSessionFindings, type RoutedFinding } from "./router.ts";
import { extractBugSolution, extractDecision, extractKnowledge, type Solution } from "./extractor.ts";
import { findPotentialDuplicates, assessOverlap, shouldDedup, type SolutionForDedup } from "./dedup.ts";
import { writeSolution } from "./writer.ts";
import { indexContent } from "../store/fts5-index.ts";

export interface AnalysisResult {
	solutionsFound: number;
	solutionsWritten: number;
	duplicatesMerged: number;
}

/**
 * Analyze a session at shutdown time:
 * 1. Extract findings from session events
 * 2. Route findings to bug/knowledge/decision types
 * 3. Dedup against existing solutions
 * 4. Write new solutions
 */
export function analyzeSession(
	db: Database.Database,
	cwd: string,
	sessionId: string,
	dedupThreshold: number = 0.7,
): AnalysisResult {
	const events = getSessionEvents(db, sessionId);
	if (events.length === 0) return { solutionsFound: 0, solutionsWritten: 0, duplicatesMerged: 0 };

	const findings = routeSessionFindings(events);
	let solutionsFound = 0;
	let solutionsWritten = 0;
	let duplicatesMerged = 0;

	for (const finding of findings) {
		const solution = extractSolution(finding);
		if (!solution) continue;
		solutionsFound++;

		const title = buildTitle(finding, finding.events);
		const solForDedup: SolutionForDedup = {
			title,
			content: solutionContent(solution),
			files: solution.files,
			tags: solution.tags,
		};

		// Check for duplicates
		const dupes = findPotentialDuplicates(db, title);
		let isDuplicate = false;
		for (const dupe of dupes) {
			const dupeForCompare: SolutionForDedup = {
				title: dupe.title,
				content: dupe.content,
				files: dupe.files ? JSON.parse(dupe.files) as string[] : [],
				tags: dupe.tags ? JSON.parse(dupe.tags) as string[] : [],
			};
			const overlap = assessOverlap(solForDedup, dupeForCompare);
			if (shouldDedup(overlap, dedupThreshold)) {
				isDuplicate = true;
				duplicatesMerged++;
				// Increment access count on the existing solution
				db.prepare(
					`UPDATE solutions SET access_count = access_count + 1, last_accessed_at = ? WHERE title = ?`,
				).run(new Date().toISOString(), dupe.title);
				break;
			}
		}

		if (!isDuplicate) {
			writeSolutionToDb(db, title, solution);
			writeSolution(cwd, solution, title);
			solutionsWritten++;
		}
	}

	return { solutionsFound, solutionsWritten, duplicatesMerged };
}

function extractSolution(finding: RoutedFinding): Solution | null {
	const events = finding.events;
	switch (finding.type) {
		case "bug": {
			const error = events.find((e) => e.type === "error");
			const fix = events.find((e) => e.type === "command_success") ?? null;
			if (!error) return null;
			return extractBugSolution(error, fix);
		}
		case "decision": {
			const decision = events.find((e) => e.type === "user_decision");
			if (!decision) return null;
			return extractDecision(decision);
		}
		case "knowledge":
			return extractKnowledge(events);
		default:
			return null;
	}
}

function buildTitle(finding: RoutedFinding, events: typeof finding.events): string {
	switch (finding.type) {
		case "bug": {
			const error = events.find((e) => e.type === "error");
			if (!error) return "Unknown bug";
			try {
				const data = JSON.parse(error.data) as Record<string, unknown>;
				const msg = typeof data.errorMessage === "string" ? data.errorMessage : "error";
				return msg.slice(0, 80);
			} catch {
				return "Unknown bug";
			}
		}
		case "decision": {
			const d = events.find((e) => e.type === "user_decision");
			if (!d) return "Decision";
			try {
				const data = JSON.parse(d.data) as Record<string, unknown>;
				return typeof data.message_summary === "string" ? data.message_summary.slice(0, 80) : "Decision";
			} catch {
				return "Decision";
			}
		}
		case "knowledge": {
			const files = events
				.map((e) => { try { return (JSON.parse(e.data) as Record<string, unknown>).file as string; } catch { return ""; } })
				.filter((f) => f.length > 0);
			return files.length > 0 ? `Pattern: ${files.join(", ")}` : "Knowledge pattern";
		}
		default:
			return "Unknown finding";
	}
}

function solutionContent(solution: Solution): string {
	switch (solution.type) {
		case "bug": return `${solution.problem}\n${solution.rootCause}\n${solution.fix}`;
		case "knowledge": return `${solution.whenToUse}\n${solution.how}`;
		case "decision": return `${solution.context}\n${solution.reasoning}`;
	}
}

function writeSolutionToDb(db: Database.Database, title: string, solution: Solution): void {
	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	const content = solutionContent(solution);
	const overlapHash = crypto.createHash("sha256").update(title + content).digest("hex");

	db.prepare(`
		INSERT INTO solutions (id, problem_type, category, title, content, files, tags, severity, overlap_hash, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`).run(
		id,
		solution.type,
		solution.type,
		title,
		content,
		JSON.stringify(solution.files),
		JSON.stringify(solution.tags),
		"medium",
		overlapHash,
		now,
		now,
	);

	// Index for search
	indexContent(db, id, title, content, solution.type);
}
