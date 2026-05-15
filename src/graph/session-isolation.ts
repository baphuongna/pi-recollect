/**
 * Session Isolation - pi-recollect
 * 
 * Provides session-scoped memory isolation so memories from one session
 * don't contaminate another session's context.
 */

// Types aligned with memory-store.ts
type MemoryCategory = 'observation' | 'summary' | 'decision' | 'pattern' | 'task';

interface GraphNode {
  id: string;
  content: string;
  category?: MemoryCategory;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

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
 * Uses a mutex per session to prevent TOCTOU race conditions in capacity enforcement.
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
  // Mutex locks per session to prevent concurrent capacity check + add race
  const sessionLocks = new Map<string, { promise: Promise<void>; release: () => void }>();

  function acquireLock(sessionId: string): { promise: Promise<void>; release: () => void } {
    // Wait for any existing lock to release
    const existing = sessionLocks.get(sessionId);
    const waitForExisting = existing ? existing.promise : Promise.resolve();
    
    let releaseFn: () => void;
    const promise = new Promise<void>(resolve => {
      releaseFn = resolve;
    });
    
    const lock = { promise: waitForExisting.then(() => promise), release: releaseFn! };
    sessionLocks.set(sessionId, lock);
    return lock;
  }

  return {
    /**
     * Get all memories for a specific session
     */
    getSessionMemories(sessionId: string): SessionAwareMemory[] {
      if (sessionCache.has(sessionId)) {
        return sessionCache.get(sessionId)!;
      }
      
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
     * Uses mutex lock to prevent TOCTOU race between capacity check and add.
     */
    storeInSession(
      sessionId: string,
      content: string,
      category?: MemoryCategory,
      metadata: Record<string, unknown> = {}
    ): GraphNode {
      const lock = acquireLock(sessionId);
      
      return lock.promise.then(() => {
        try {
          const current = this.getSessionMemories(sessionId);
          if (current.length >= maxMemoriesPerSession) {
            const oldest = current.sort((a, b) => a.created - b.created)[0];
            store.deleteNode(oldest.nodeId);
            sessionCache.delete(sessionId);
          }
          
          const node = store.addNode({
            content,
            category,
            metadata: {
              ...metadata,
              sessionId,
              lastAccessed: Date.now()
            }
          });
          
          sessionCache.delete(sessionId);
          return node;
        } finally {
          lock.release();
          // Clean up lock if this was the last one
          const currentLock = sessionLocks.get(sessionId);
          if (currentLock?.promise === lock.promise) {
            sessionLocks.delete(sessionId);
          }
        }
      }) as unknown as GraphNode;
    },
    
    /**
     * Store a memory in a specific session (sync version with lock)
     */
    storeInSessionSync(
      sessionId: string,
      content: string,
      category?: MemoryCategory,
      metadata: Record<string, unknown> = {}
    ): GraphNode {
      const lock = acquireLock(sessionId);
      
      try {
        const current = this.getSessionMemories(sessionId);
        if (current.length >= maxMemoriesPerSession) {
          const oldest = current.sort((a, b) => a.created - b.created)[0];
          store.deleteNode(oldest.nodeId);
          sessionCache.delete(sessionId);
        }
        
        const node = store.addNode({
          content,
          category,
          metadata: {
            ...metadata,
            sessionId,
            lastAccessed: Date.now()
          }
        });
        
        sessionCache.delete(sessionId);
        return node;
      } finally {
        lock.release();
        sessionLocks.delete(sessionId);
      }
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
        this.storeInSessionSync(toSession, memory.content, memory.category);
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
