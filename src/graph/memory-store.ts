/**
 * Graph-based memory store with SQLite + FTS5
 * Based on beads and context-mode patterns
 */

import Database from 'better-sqlite3';
import { generateHashId } from './hash-id.ts';

export interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  type: 'observation' | 'summary' | 'decision' | 'pattern' | 'task';
  embeddings?: number[];
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'closed' | 'compacted';
  project?: string;
  tags?: string[];
}

export interface MemoryQuery {
  query?: string;
  type?: string;
  status?: string;
  project?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export class GraphMemoryStore {
  private db: Database.Database;
  private projectId: string;

  constructor(dbPath: string, projectId: string = 'default') {
    this.db = new Database(dbPath);
    this.projectId = projectId;
    this.initialize();
  }

  private initialize(): void {
    // Main memory table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'observation',
        embeddings TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        project TEXT NOT NULL,
        tags TEXT
      )
    `);

    // FTS5 index for full-text search
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
        key,
        value,
        content='memory',
        content_rowid='rowid'
      )
    `);

    // Triggers to keep FTS in sync
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS memory_ai AFTER INSERT ON memory BEGIN
        INSERT INTO memory_fts(rowid, key, value) VALUES (NEW.rowid, NEW.key, NEW.value);
      END
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS memory_ad AFTER DELETE ON memory BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, key, value) VALUES('delete', OLD.rowid, OLD.key, OLD.value);
      END
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS memory_au AFTER UPDATE ON memory BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, key, value) VALUES('delete', OLD.rowid, OLD.key, OLD.value);
        INSERT INTO memory_fts(rowid, key, value) VALUES (NEW.rowid, NEW.key, NEW.value);
      END
    `);

    // Relationships table for graph
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS relationships (
        id TEXT PRIMARY KEY,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (from_id) REFERENCES memory(id),
        FOREIGN KEY (to_id) REFERENCES memory(id)
      )
    `);

    // Indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memory_project ON memory(project);
      CREATE INDEX IF NOT EXISTS idx_memory_type ON memory(type);
      CREATE INDEX IF NOT EXISTS idx_memory_status ON memory(status);
      CREATE INDEX IF NOT EXISTS idx_memory_updated ON memory(updated_at);
    `);
  }

  /**
   * Store a memory entry
   */
  async remember(
    key: string,
    value: string,
    type: MemoryEntry['type'] = 'observation',
    options: { tags?: string[]; project?: string } = {}
  ): Promise<MemoryEntry> {
    const id = generateHashId(key);
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO memory (id, key, value, type, created_at, updated_at, status, project, tags)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `);

    stmt.run(
      id,
      key,
      value,
      type,
      now,
      now,
      options.project || this.projectId,
      JSON.stringify(options.tags || [])
    );

    return {
      id,
      key,
      value,
      type,
      createdAt: now,
      updatedAt: now,
      status: 'active',
      project: options.project || this.projectId,
      tags: options.tags,
    };
  }

  /**
   * Query memories using FTS5 BM25 search
   */
  query(q: MemoryQuery): MemoryEntry[] {
    const { query, type, status, project, limit = 10, offset = 0 } = q;

    let sql = 'SELECT * FROM memory WHERE 1=1';
    const params: (string | number)[] = [];

    if (query) {
      sql = `
        SELECT m.*, bm25(memory_fts) as rank
        FROM memory m
        JOIN memory_fts f ON m.rowid = f.rowid
        WHERE memory_fts MATCH ?
      `;
      params.push(query);
    }

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (project) {
      sql += ' AND project = ?';
      params.push(project);
    }

    if (query) {
      sql += ' ORDER BY rank';
    } else {
      sql += ' ORDER BY updated_at DESC';
    }

    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = this.db.prepare(sql).all(...params) as any[];

    return rows.map((row) => ({
      id: row.id,
      key: row.key,
      value: row.value,
      type: row.type,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status,
      project: row.project,
      tags: JSON.parse(row.tags || '[]'),
    }));
  }

  /**
   * Add a relationship between two memories
   */
  async relate(
    fromId: string,
    toId: string,
    type: 'depends_on' | 'related_to' | 'blocks' | 'supersedes'
  ): Promise<void> {
    const id = generateHashId(`${fromId}-${toId}-${type}`);
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO relationships (id, from_id, to_id, type, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, fromId, toId, type, Date.now());
  }

  /**
   * Get related memories
   */
  getRelated(id: string, type?: string): MemoryEntry[] {
    let sql = `
      SELECT m.*
      FROM relationships r
      JOIN memory m ON r.to_id = m.id
      WHERE r.from_id = ?
    `;
    const params: string[] = [id];

    if (type) {
      sql += ' AND r.type = ?';
      params.push(type);
    }

    const rows = this.db.prepare(sql).all(...params) as any[];

    return rows.map((row) => ({
      id: row.id,
      key: row.key,
      value: row.value,
      type: row.type,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status,
      project: row.project,
      tags: JSON.parse(row.tags || '[]'),
    }));
  }

  /**
   * Close memory status
   */
  close(id: string): void {
    const stmt = this.db.prepare(`
      UPDATE memory SET status = 'closed', updated_at = ? WHERE id = ?
    `);
    stmt.run(Date.now(), id);
  }

  /**
   * Update memory value
   */
  update(id: string, value: string): void {
    const stmt = this.db.prepare(`
      UPDATE memory SET value = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(value, Date.now(), id);
  }

  /**
   * Close database
   */
  close(): void {
    this.db.close();
  }
}
