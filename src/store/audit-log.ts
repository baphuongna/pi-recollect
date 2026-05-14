import * as crypto from "node:crypto";
import type Database from "better-sqlite3";

/**
 * Audit entry stored in the `audit_log` table.
 */
export interface AuditEntry {
	id: string;
	timestamp: string;
	operation: "delete" | "forget" | "compact" | "reindex" | string;
	functionId: string;
	targetIds: string[];
	details: Record<string, unknown>;
}

/**
 * Filter options for querying audit entries.
 */
export interface AuditFilter {
	operation?: string;
	dateFrom?: string;
	dateTo?: string;
	limit?: number;
}

/**
 * Write an audit row to the audit_log table.
 *
 * Call BEFORE any structural deletion or bulk operation to maintain
 * compliance coverage.  See audit.ts in agentmemory for the policy
 * (issue #125) governing scoped vs. bulk audit shapes.
 *
 * @param db        - SQLite database handle
 * @param operation - One of: "delete", "forget", "compact", "reindex", etc.
 * @param functionId - Name of the function initiating the operation
 * @param targetIds  - Array of affected row IDs
 * @param details    - Arbitrary metadata (e.g. {count: 42})
 */
export function recordAudit(
	db: Database.Database,
	operation: AuditEntry["operation"],
	functionId: string,
	targetIds: string[],
	details: Record<string, unknown> = {},
): AuditEntry {
	const entry: AuditEntry = {
		id: crypto.randomUUID(),
		timestamp: new Date().toISOString(),
		operation,
		functionId,
		targetIds,
		details,
	};
	db.prepare(`
		INSERT INTO audit_log (id, timestamp, operation, function_id, target_ids, details)
		VALUES (?, ?, ?, ?, ?, ?)
	`).run(
		entry.id,
		entry.timestamp,
		entry.operation,
		entry.functionId,
		JSON.stringify(entry.targetIds),
		JSON.stringify(entry.details),
	);
	return entry;
}

/**
 * Query the audit log with optional time-range and operation filtering.
 */
export function queryAudit(
	db: Database.Database,
	filter: AuditFilter = {},
): AuditEntry[] {
	let sql = `SELECT * FROM audit_log`;
	const conditions: string[] = [];
	const params: unknown[] = [];

	if (filter.operation) {
		conditions.push(`operation = ?`);
		params.push(filter.operation);
	}
	if (filter.dateFrom) {
		conditions.push(`timestamp >= ?`);
		params.push(filter.dateFrom);
	}
	if (filter.dateTo) {
		conditions.push(`timestamp <= ?`);
		params.push(filter.dateTo);
	}

	if (conditions.length > 0) {
		sql += ` WHERE ` + conditions.join(` AND `);
	}

	sql += ` ORDER BY timestamp DESC`;
	sql += ` LIMIT ${filter.limit ?? 100}`;

	const rows = db.prepare(sql).all(...params) as Array<{
		id: string;
		timestamp: string;
		operation: string;
		function_id: string;
		target_ids: string;
		details: string;
	}>;

	return rows.map((row) => ({
		id: row.id,
		timestamp: row.timestamp,
		operation: row.operation,
		functionId: row.function_id,
		targetIds: JSON.parse(row.target_ids) as string[],
		details: JSON.parse(row.details) as Record<string, unknown>,
	}));
}