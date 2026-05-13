/**
 * Runtime-Aware Database Manager
 * 
 * Pattern for cross-runtime SQLite support.
 * Automatically falls back from better-sqlite3 to bun:sqlite when running in Bun.
 */

import { createRequire } from "node:module";

/**
 * Check if running in Bun runtime.
 */
export function isBunRuntime(): boolean {
  return typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";
}

/**
 * Check if an error indicates better-sqlite3 incompatibility with Bun.
 */
export function isBunIncompatibleError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  return (
    msg.includes("better-sqlite3 is not yet supported in bun") ||
    msg.includes("not yet supported in bun")
  );
}

/**
 * Statement-like interface for database operations.
 */
export interface StatementLike {
  run: (...args: unknown[]) => unknown;
  get: (...args: unknown[]) => unknown;
  all: (...args: unknown[]) => unknown;
}

/**
 * Database-like interface for database operations.
 */
export interface DatabaseLike {
  prepare: (sql: string) => StatementLike;
  exec: (sql: string) => void;
  close: () => void;
}

/**
 * Bun-specific database instance type.
 */
type BunDatabaseInstance = {
  prepare: (sql: string) => StatementLike;
  exec: (sql: string) => void;
  close: (throwOnError?: boolean) => void;
};

/**
 * Database constructor type.
 */
type DatabaseCtor = new (dbPath: string) => DatabaseLike;

/**
 * Load the appropriate database constructor based on runtime.
 */
export function loadDatabaseCtor(): DatabaseCtor {
  const require = createRequire(import.meta.url);

  try {
    // Try better-sqlite3 first
    const mod = require("better-sqlite3") as { default?: DatabaseCtor } | DatabaseCtor;
    return (mod as { default?: DatabaseCtor }).default ?? (mod as DatabaseCtor);
  } catch (err) {
    // Check if this is a Bun incompatibility error
    if (!isBunIncompatibleError(err)) {
      throw err;
    }

    // Check if we're actually in Bun runtime
    if (!isBunRuntime()) {
      throw err;
    }

    // Fall back to bun:sqlite
    const bunSqlite = require("bun:sqlite") as { Database: new (dbPath: string) => BunDatabaseInstance };

    return class BunCompatDatabase implements DatabaseLike {
      private readonly db: BunDatabaseInstance;

      constructor(dbPath: string) {
        this.db = new bunSqlite.Database(dbPath);
      }

      prepare(sql: string): StatementLike {
        return this.db.prepare(sql);
      }

      exec(sql: string): void {
        this.db.exec(sql);
      }

      close(): void {
        this.db.close();
      }
    };
  }
}

/**
 * Get the database constructor (cached).
 */
let _Database: DatabaseCtor | null = null;

export function getDatabase(): DatabaseCtor {
  if (_Database === null) {
    _Database = loadDatabaseCtor();
  }
  return _Database;
}
