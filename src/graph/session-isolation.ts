/**
 * Session Isolation - pi-recollect
 * 
 * Provides session-scoped memory isolation so memories from one session
 * don't contaminate another session's context.
 */

import type { MemoryCategory, GraphNode } from '../types.js';

export interface SessionAwareMemory {
  sessionId: string;
  nodeId: string;
  content: string;
  category?: MemoryCategory;
  created: number;
  lastAccessed: number;
}

export interface SessionIsolationOptions {
  /** Maximum memories per session (default: 100) */
  maxMemoriesPerSession?: number;
  /** TTL for session memories in ms (default: 7 days) */
  sessionTtl?: number;
}

/**
 * Creates session isolation layer for memory operations
 */
export function createSessionIsolation(
  store: {
    getNodes: (filter?: { category?: MemoryCategory }) => GraphNode[];
    addNode: (node: Omit<GraphNode, 'id' | 'timestamp'>) => GraphNode;
    updateNode: (id: string, updates: Partial<GraphNode>) => void;
    deleteNode: (id: string) => void;
  },
  options: SessionIsolationOptions = {}
) {
  const { maxMemoriesPerSession = 100, sessionTtl = 7 * 24 * 60 * 60 * 1000 } = options;
  
  // Session-scoped memory cache
  const sessionCache = new Map<string, SessionAwareMemory[]>();
  
  return {
    /**
     * Get all memories for a specific session
     */
    getSessionMemories(sessionId: string): SessionAwareMemory[] {
      // Check cache first
      if (sessionCache.has(sessionId)) {
        return sessionCache.get(sessionId)!;
      }
      
      // Load from store
      const nodes = store.getNodes();
      const sessionMemories: SessionAwareMemory[] = [];
      
      for (const node of nodes) {
        if ((node.metadata as Record<string, unknown>)?.sessionId === sessionId) {
          sessionMemories.push({
            sessionId,
            nodeId: node.id,
            content: node.content,
            category: node.category,
            created: node.timestamp,
            lastAccessed: (node.metadata as Record<string, unknown>)?.lastAccessed as number || node.timestamp
          });
        }
      }
      
      sessionCache.set(sessionId, sessionMemories);
      return sessionMemories;
    },
    
    /**
     * Store a memory in a specific session
     */
    storeInSession(
      sessionId: string,
      content: string,
      category?: MemoryCategory,
      metadata: Record<string, unknown> = {}
    ): GraphNode {
      // Check capacity
      const current = this.getSessionMemories(sessionId);
      if (current.length >= maxMemoriesPerSession) {
        // Remove oldest
        const oldest = current.sort((a, b) => a.created - b.created)[0];
        store.deleteNode(oldest.nodeId);
        sessionCache.delete(sessionId);
      }
      
      // Add new memory
      const node = store.addNode({
        content,
        category,
        metadata: {
          ...metadata,
          sessionId,
          lastAccessed: Date.now()
        }
      });
      
      // Invalidate cache
      sessionCache.delete(sessionId);
      
      return node;
    },
    
    /**
     * Purge all memories for a session
     */
    purgeSession(sessionId: string): number {
      const memories = this.getSessionMemories(sessionId);
      let count = 0;
      
      for (const memory of memories) {
        store.deleteNode(memory.nodeId);
        count++;
      }
      
      sessionCache.delete(sessionId);
      return count;
    },
    
    /**
     * Clone memories from one session to another
     */
    cloneToSession(fromSession: string, toSession: string): number {
      const memories = this.getSessionMemories(fromSession);
      let count = 0;
      
      for (const memory of memories) {
        this.storeInSession(toSession, memory.content, memory.category);
        count++;
      }
      
      return count;
    },
    
    /**
     * Clean up expired session memories
     */
    cleanupExpired(): number {
      const now = Date.now();
      let count = 0;
      
      for (const [sessionId, memories] of sessionCache.entries()) {
        const expired = memories.filter(m => now - m.lastAccessed > sessionTtl);
        for (const m of expired) {
          store.deleteNode(m.nodeId);
          count++;
        }
        if (expired.length > 0) {
          sessionCache.delete(sessionId);
        }
      }
      
      return count;
    },
    
    /**
     * Get session statistics
     */
    getSessionStats(sessionId: string): {
      count: number;
      categories: Record<string, number>;
      oldest: number | null;
      newest: number | null;
    } {
      const memories = this.getSessionMemories(sessionId);
      const categories: Record<string, number> = {};
      
      for (const m of memories) {
        const cat = m.category || 'uncategorized';
        categories[cat] = (categories[cat] || 0) + 1;
      }
      
      return {
        count: memories.length,
        categories,
        oldest: memories.length > 0 ? Math.min(...memories.map(m => m.created)) : null,
        newest: memories.length > 0 ? Math.max(...memories.map(m => m.created)) : null
      };
    }
  };
}
