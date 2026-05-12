import type Database from "better-sqlite3";
import { getSessionEvents, getRecentEvents } from "../store/events.ts";

export interface ResumeContext {
	lastFiles: string[];
	lastError: string | null;
	lastTask: string | null;
	status: string;
	sessionId: string | null;
}

/**
 * Build a resume context from the most recent session's events.
 */
export function buildResumeContext(db: Database.Database): ResumeContext | null {
	// Find the most recent session
	const recentEvents = getRecentEvents(db, 100);
	if (recentEvents.length === 0) return null;

	// Group by session
	const sessionMap = new Map<string, typeof recentEvents>();
	for (const event of recentEvents) {
		const sid = event.session_id ?? "__unknown__";
		if (!sessionMap.has(sid)) sessionMap.set(sid, []);
		sessionMap.get(sid)!.push(event);
	}

	// Find the most recent session (by its latest event)
	let latestSessionId: string | null = null;
	let latestTimestamp = "";
	for (const [sid, events] of sessionMap) {
		const lastEvent = events[0]; // already sorted DESC
		if (lastEvent && lastEvent.timestamp > latestTimestamp) {
			latestTimestamp = lastEvent.timestamp;
			latestSessionId = sid;
		}
	}

	if (!latestSessionId || latestSessionId === "__unknown__") return null;

	return buildSessionResumeContext(db, latestSessionId);
}

/**
 * Build resume context for a specific session.
 */
export function buildSessionResumeContext(db: Database.Database, sessionId: string): ResumeContext | null {
	const events = getSessionEvents(db, sessionId);
	if (events.length === 0) return null;

	const files: string[] = [];
	let lastError: string | null = null;
	let lastTask: string | null = null;

	for (const event of events) {
		try {
			const data = JSON.parse(event.data) as Record<string, unknown>;
			if (event.type === "file_edit" && typeof data.file === "string") {
				if (!files.includes(data.file)) files.push(data.file);
			}
			if (event.type === "error" && typeof data.errorMessage === "string") {
				lastError = data.errorMessage;
			}
			if (event.type === "user_decision" && typeof data.message_summary === "string") {
				lastTask = data.message_summary;
			}
		} catch { /* skip malformed data */ }
	}

	// Determine status
	const hasErrors = events.some((e) => e.type === "error");
	const status = hasErrors ? "had errors" : "completed successfully";

	return {
		lastFiles: files,
		lastError,
		lastTask,
		status,
		sessionId,
	};
}

/**
 * Format a resume context as a human-readable prompt.
 */
export function formatResumeContext(context: ResumeContext, maxBytes: number = 1024): string {
	const lines: string[] = [
		"Previous session context:",
		`- Last working on: "${context.lastTask ?? "unknown task"}"`,
	];
	if (context.lastFiles.length > 0) {
		lines.push(`- Files modified: ${context.lastFiles.join(", ")}`);
	}
	if (context.lastError) {
		lines.push(`- Last error: "${context.lastError}"`);
	}
	lines.push(`- Status: ${context.status}`);
	lines.push("Continue where you left off?");

	const text = lines.join("\n");
	const encoded = new TextEncoder().encode(text);
	if (encoded.length <= maxBytes) return text;
	return new TextDecoder().decode(encoded.slice(0, maxBytes));
}
