import * as fs from "node:fs";
import * as path from "node:path";
import BetterSqlite3 from "better-sqlite3";
import type Database from "better-sqlite3";
import { initSchema } from "./schema.ts";

/**
 * Manages the SQLite database connection for pi-recall.
 * Database is stored at <cwd>/.pi-recall/memory.db.
 */
export class MemoryDB {
	public readonly cwd: string;
	public readonly dbPath: string;
	private db: Database.Database | null = null;

	constructor(cwd: string) {
		this.cwd = cwd;
		const dir = path.join(cwd, ".pi-recall");
		fs.mkdirSync(dir, { recursive: true });
		this.dbPath = path.join(dir, "memory.db");
	}

	/** Open (or return existing) database connection with full schema. */
	open(): Database.Database {
		if (this.db) return this.db;
		this.db = new BetterSqlite3(this.dbPath) as unknown as Database.Database;
		initSchema(this.db);
		return this.db;
	}

	/** Get the current open connection (throws if not open). */
	getConnection(): Database.Database {
		if (!this.db) throw new Error("MemoryDB not opened. Call open() first.");
		return this.db;
	}

	/** Close the database connection. */
	close(): void {
		if (this.db) {
			try {
				this.db.close();
			} catch {
				// Ignore close errors
			}
			this.db = null;
		}
	}

	/** Check if the database is currently open. */
	get isOpen(): boolean {
		return this.db !== null;
	}
}
