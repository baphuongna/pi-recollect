/**
 * SQLite-backed Graph Store
 * 
 * Hybrid pattern combining:
 * - beads: Hash-based IDs for merge-free collaboration
 * - hermes-memory: SQLite persistence + failure learning
 * - Dolt: SQL + Git-like versioning for graph data
 */

import { randomUUID } from 'node:crypto';
import { createHash } from 'crypto';

export interface GraphNode {
  id: string;
  type: 'issue' | 'task' | 'insight' | 'memory' | 'failure';
  title: string;
  content?: string;
  createdAt: string;
  updatedAt: string;
  relations: Relation[];
  closed?: boolean;
  metadata?: Record<string, unknown>;
  stale?: boolean;
  // hermes-memory: Failure learning
  failureCount?: number;
  lastFailure?: string;
  successRate?: number;
}

export interface Relation {
  type: 'relates_to' | 'duplicates' | 'supersedes' | 'replies_to' | 'blocks' | 'depends_on';
  targetId: string;
}

export interface SQLiteGraphStore {
  // Core graph operations
  addNode(node: Omit<GraphNode, 'id'>): GraphNode;
  getNode(id: string): GraphNode | undefined;
  updateNode(id: string, updates: Partial<GraphNode>): GraphNode | undefined;
  closeNode(id: string): GraphNode | undefined;
  
  // Relations
  addRelation(sourceId: string, relation: Relation): void;
  getRelations(id: string): Relation[];
  getRelatedNodes(id: string, type?: Relation['type']): GraphNode[];
  
  // Query
  query(filter: GraphQuery): GraphNode[];
  
  // Maintenance
  compact(olderThan: Date): number;
  
  // hermes-memory: Failure learning
  recordFailure(nodeId: string, error: string): void;
  recordSuccess(nodeId: string): void;
  getFailureInsights(): FailureInsight[];
  
  // Dolt-like: Version tracking
  getHistory(nodeId: string): GraphNode[];
}

export interface GraphQuery {
  type?: GraphNode['type'];
  closed?: boolean;
  relationType?: Relation['type'];
  relationTarget?: string;
  stale?: boolean;
}

export interface FailureInsight {
  nodeId: string;
  title: string;
  failureCount: number;
  lastFailure?: string;
  successRate: number;
  recommendation?: string;
}

export function generateHashId(prefix: string = 'node'): string {
  const hash = createHash('sha256')
    .update(randomUUID())
    .digest('hex')
    .substring(0, 8);
  return `${prefix}-${hash}`;
}

/**
 * Create SQLite-backed graph store
 * 
 * Schema:
 * - nodes: id, type, title, content, created_at, updated_at, closed, metadata, failure_count, last_failure, success_rate
 * - relations: id, source_id, type, target_id
 * - history: id, node_id, snapshot, timestamp
 */
export function createSQLiteGraphStore(db: Database): SQLiteGraphStore {
  // Initialize schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      closed INTEGER DEFAULT 0,
      metadata TEXT,
      failure_count INTEGER DEFAULT 0,
      last_failure TEXT,
      success_rate REAL DEFAULT 1.0
    );
    
    CREATE TABLE IF NOT EXISTS relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id TEXT NOT NULL,
      type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      FOREIGN KEY (source_id) REFERENCES nodes(id)
    );
    
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT NOT NULL,
      snapshot TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (node_id) REFERENCES nodes(id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
    CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_id);
    CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_id);
    CREATE INDEX IF NOT EXISTS idx_history_node ON history(node_id);
  `);

  return {
    addNode(node) {
      const id = generateHashId(node.type.substring(0, 4));
      const now = new Date().toISOString();
      
      const fullNode: GraphNode = {
        ...node,
        id,
        createdAt: now,
        updatedAt: now,
        relations: node.relations ?? [],
        failureCount: 0,
        successRate: 1.0,
      };
      
      db.exec(`
        INSERT INTO nodes (id, type, title, content, created_at, updated_at, closed, metadata, failure_count, success_rate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        fullNode.id,
        fullNode.type,
        fullNode.title,
        fullNode.content ?? null,
        fullNode.createdAt,
        fullNode.updatedAt,
        fullNode.closed ? 1 : 0,
        fullNode.metadata ? JSON.stringify(fullNode.metadata) : null,
        0,
        1.0
      ]);
      
      // Save initial history
      db.exec(`INSERT INTO history (node_id, snapshot, timestamp) VALUES (?, ?, ?)`,
        [id, JSON.stringify(fullNode), now]);
      
      return fullNode;
    },

    getNode(id) {
      const row = db.exec(`SELECT * FROM nodes WHERE id = ?`, [id])[0];
      if (!row) return undefined;
      return rowToNode(row);
    },

    updateNode(id, updates) {
      const node = this.getNode(id);
      if (!node) return undefined;
      
      const now = new Date().toISOString();
      const updated = { ...node, ...updates, updatedAt: now };
      
      db.exec(`
        UPDATE nodes SET
          type = ?, title = ?, content = ?, updated_at = ?,
          closed = ?, metadata = ?, failure_count = ?, last_failure = ?, success_rate = ?
        WHERE id = ?
      `, [
        updated.type,
        updated.title,
        updated.content ?? null,
        updated.updatedAt,
        updated.closed ? 1 : 0,
        updated.metadata ? JSON.stringify(updated.metadata) : null,
        updated.failureCount ?? 0,
        updated.lastFailure ?? null,
        updated.successRate ?? 1.0,
        id
      ]);
      
      // Save history snapshot
      db.exec(`INSERT INTO history (node_id, snapshot, timestamp) VALUES (?, ?, ?)`,
        [id, JSON.stringify(updated), now]);
      
      return updated;
    },

    closeNode(id) {
      return this.updateNode(id, { closed: true });
    },

    addRelation(sourceId, relation) {
      db.exec(`INSERT INTO relations (source_id, type, target_id) VALUES (?, ?, ?)`,
        [sourceId, relation.type, relation.targetId]);
    },

    getRelations(id) {
      const rows = db.exec(`SELECT * FROM relations WHERE source_id = ?`, [id]);
      return rows.map(row => ({
        type: row.type as Relation['type'],
        targetId: row.target_id as string,
      }));
    },

    getRelatedNodes(id, type) {
      const query = type
        ? `SELECT n.* FROM nodes n JOIN relations r ON n.id = r.target_id WHERE r.source_id = ? AND r.type = ?`
        : `SELECT n.* FROM nodes n JOIN relations r ON n.id = r.target_id WHERE r.source_id = ?`;
      const params = type ? [id, type] : [id];
      const rows = db.exec(query, params);
      return rows.map(rowToNode);
    },

    query(filter) {
      let sql = 'SELECT * FROM nodes WHERE 1=1';
      const params: unknown[] = [];
      
      if (filter.type) {
        sql += ' AND type = ?';
        params.push(filter.type);
      }
      if (filter.closed !== undefined) {
        sql += ' AND closed = ?';
        params.push(filter.closed ? 1 : 0);
      }
      if (filter.stale !== undefined) {
        sql += ' AND stale = ?';
        params.push(filter.stale ? 1 : 0);
      }
      
      const rows = db.exec(sql, params);
      return rows.map(rowToNode);
    },

    compact(olderThan) {
      let compacted = 0;
      const threshold = olderThan.toISOString();
      
      const closed = this.query({ closed: true });
      for (const node of closed) {
        if (node.updatedAt < threshold && node.content && node.content.length > 100) {
          this.updateNode(node.id, {
            content: `[Compact ${new Date(node.updatedAt).toLocaleDateString()}] ${node.title}`,
            stale: true,
          });
          compacted++;
        }
      }
      return compacted;
    },

    // hermes-memory: Failure learning
    recordFailure(nodeId: string, error: string) {
      const node = this.getNode(nodeId);
      if (!node) return;
      
      const failureCount = (node.failureCount ?? 0) + 1;
      const totalAttempts = failureCount + Math.round((node.successRate ?? 1.0) * 10);
      const successRate = (totalAttempts - failureCount) / totalAttempts;
      
      this.updateNode(nodeId, {
        failureCount,
        lastFailure: `${error} at ${new Date().toISOString()}`,
        successRate: Math.max(0, successRate),
      });
    },

    recordSuccess(nodeId: string) {
      const node = this.getNode(nodeId);
      if (!node) return;
      
      const failureCount = node.failureCount ?? 0;
      const totalAttempts = failureCount + Math.round((node.successRate ?? 1.0) * 10) + 1;
      const successRate = (totalAttempts - failureCount) / totalAttempts;
      
      this.updateNode(nodeId, {
        successRate: Math.min(1.0, successRate),
      });
    },

    getFailureInsights() {
      const nodes = this.query({ type: 'failure' });
      return nodes
        .filter(n => (n.failureCount ?? 0) > 0)
        .map(n => ({
          nodeId: n.id,
          title: n.title,
          failureCount: n.failureCount ?? 0,
          lastFailure: n.lastFailure,
          successRate: n.successRate ?? 0,
          recommendation: generateRecommendation(n),
        }))
        .sort((a, b) => b.failureCount - a.failureCount);
    },

    // Dolt-like: Version history
    getHistory(nodeId: string) {
      const rows = db.exec(
        `SELECT * FROM history WHERE node_id = ? ORDER BY timestamp DESC`,
        [nodeId]
      );
      return rows.map(row => JSON.parse(row.snapshot as string));
    },
  };
}

function rowToNode(row: Record<string, unknown>): GraphNode {
  return {
    id: row.id as string,
    type: row.type as GraphNode['type'],
    title: row.title as string,
    content: row.content as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    closed: row.closed === 1,
    metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
    failureCount: row.failure_count as number,
    lastFailure: row.last_failure as string | undefined,
    successRate: row.success_rate as number,
    relations: [],
  };
}

function generateRecommendation(node: GraphNode): string {
  const rate = node.successRate ?? 1.0;
  if (rate < 0.3) {
    return 'Critical: Consider alternative approach or deprecate';
  } else if (rate < 0.6) {
    return 'Warning: Review failure patterns and fix root cause';
  } else if (rate < 0.8) {
    return 'Info: Minor issues detected, monitor closely';
  }
  return 'Good: Continue current approach';
}

// Minimal Database type for SQLite (without requiring better-sqlite3 dependency)
interface Database {
  exec(sql: string, params?: unknown[]): Record<string, unknown>[];
}
