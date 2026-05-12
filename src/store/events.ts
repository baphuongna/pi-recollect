import type Database from "better-sqlite3";

export interface SessionEvent {
	id: number;
	session_id: string | null;
	type: string;
	data: string;
	timestamp: string;
}

/**
 * Log a session event to the events table.
 */
export function logEvent(
	db: Database.Database,
	sessionId: string | null,
	type: string,
	data: Record<string, unknown>,
): void {
	db.prepare(
		`INSERT INTO events (session_id, type, data, timestamp) VALUES (?, ?, ?, ?)`,
	).run(sessionId, type, JSON.stringify(data), new Date().toISOString());
}

/**
 * Get all events for a specific session, ordered by timestamp.
 */
export function getSessionEvents(db: Database.Database, sessionId: string): SessionEvent[] {
	return db.prepare(
		`SELECT * FROM events WHERE session_id = ? ORDER BY timestamp ASC`,
	).all(sessionId) as SessionEvent[];
}

/**
 * Get the most recent N events across all sessions.
 */
export function getRecentEvents(db: Database.Database, limit: number): SessionEvent[] {
	return db.prepare(
		`SELECT * FROM events ORDER BY timestamp DESC LIMIT ?`,
	).all(limit) as SessionEvent[];
}

/**
 * Get events of a specific type for a session.
 */
export function getEventsByType(db: Database.Database, sessionId: string, type: string): SessionEvent[] {
	return db.prepare(
		`SELECT * FROM events WHERE session_id = ? AND type = ? ORDER BY timestamp ASC`,
	).all(sessionId, type) as SessionEvent[];
}

/**
 * Delete events older than a given number of days.
 */
export function pruneOldEvents(db: Database.Database, maxAgeDays: number): number {
	const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
	const result = db.prepare(
		`DELETE FROM events WHERE timestamp < ?`,
	).run(cutoff);
	return result.changes;
}
