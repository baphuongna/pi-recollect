/**
 * Graph Store - Hash-based Issue Tracking
 * 
 * Pattern from beads: Hash-based IDs prevent merge conflicts
 * Dependency-aware graph for AI agents
 */

import { createHash } from "crypto";

export interface GraphNode {
  id: string;
  type: "issue" | "task" | "insight" | "memory";
  title: string;
  content?: string;
  createdAt: string;
  updatedAt: string;
  relations: Relation[];
  closed?: boolean;
  metadata?: Record<string, unknown>;
  stale?: boolean;
}

export interface Relation {
  type: "relates_to" | "duplicates" | "supersedes" | "replies_to" | "blocks" | "depends_on";
  targetId: string;
}

export interface GraphStore {
  addNode(node: Omit<GraphNode, "id">): GraphNode;
  getNode(id: string): GraphNode | undefined;
  updateNode(id: string, updates: Partial<GraphNode>): GraphNode | undefined;
  closeNode(id: string): GraphNode | undefined;
  addRelation(sourceId: string, relation: Relation): void;
  getRelations(id: string): Relation[];
  getRelatedNodes(id: string, type?: Relation["type"]): GraphNode[];
  compact(olderThan: Date): number;  // Memory decay
  query(filter: GraphQuery): GraphNode[];
}

export interface GraphQuery {
  type?: GraphNode["type"];
  closed?: boolean;
  relationType?: Relation["type"];
  relationTarget?: string;
}

/**
 * Generate hash-based ID (like beads)
 */
export function generateHashId(prefix: string = "node"): string {
  const hash = createHash("sha256")
    .update(`${Date.now()}-${Math.random()}`)
    .digest("hex")
    .substring(0, 8);
  return `${prefix}-${hash}`;
}

/**
 * Create graph store
 */
export function createGraphStore(): GraphStore {
  const nodes = new Map<string, GraphNode>();
  
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
      };
      
      nodes.set(id, fullNode);
      return fullNode;
    },
    
    getNode(id) {
      return nodes.get(id);
    },
    
    updateNode(id, updates) {
      const node = nodes.get(id);
      if (!node) return undefined;
      
      const updated = {
        ...node,
        ...updates,
        id: node.id,
        createdAt: node.createdAt,
        updatedAt: new Date().toISOString(),
      };
      
      nodes.set(id, updated);
      return updated;
    },
    
    closeNode(id) {
      return this.updateNode(id, { closed: true });
    },
    
    addRelation(sourceId, relation) {
      const node = nodes.get(sourceId);
      if (!node) return;
      
      node.relations.push(relation);
      node.updatedAt = new Date().toISOString();
    },
    
    getRelations(id) {
      return nodes.get(id)?.relations ?? [];
    },
    
    getRelatedNodes(id, type) {
      const node = nodes.get(id);
      if (!node) return [];
      
      const relations = type 
        ? node.relations.filter(r => r.type === type)
        : node.relations;
      
      return relations
        .map(r => nodes.get(r.targetId))
        .filter((n): n is GraphNode => n !== undefined);
    },
    
    compact(olderThan) {
      let compacted = 0;
      
      for (const [id, node] of nodes) {
        if (node.closed && new Date(node.updatedAt) < olderThan) {
          // Summarize and replace with compact version
          if (node.content && node.content.length > 100) {
            node.content = `[Compact ${new Date(node.updatedAt).toLocaleDateString()}] ${node.title}`;
            compacted++;
          }
        }
      }
      
      return compacted;
    },
    
    query(filter) {
      return Array.from(nodes.values()).filter(node => {
        if (filter.type && node.type !== filter.type) return false;
        if (filter.closed !== undefined && node.closed !== filter.closed) return false;
        if (filter.relationType) {
          const hasRelation = node.relations.some(r => r.type === filter.relationType);
          if (!hasRelation) return false;
        }
        return true;
      });
    },
  };
}
