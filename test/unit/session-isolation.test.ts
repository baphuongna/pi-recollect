import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createSessionIsolation } from '../../src/graph/session-isolation.js';

describe('Session Isolation', () => {
  // Mock store
  const nodes: any[] = [];
  const store = {
    getNodes: () => nodes,
    addNode: (node: any) => {
      const id = `node-${nodes.length}`;
      nodes.push({ ...node, id, timestamp: Date.now() });
      return nodes[nodes.length - 1];
    },
    updateNode: (id: string, updates: any) => {
      const idx = nodes.findIndex(n => n.id === id);
      if (idx >= 0) nodes[idx] = { ...nodes[idx], ...updates };
    },
    deleteNode: (id: string) => {
      const idx = nodes.findIndex(n => n.id === id);
      if (idx >= 0) nodes.splice(idx, 1);
    }
  };

  const isolation = createSessionIsolation(store);

  beforeEach(() => {
    nodes.length = 0;
  });

  it('stores memories in specific session', () => {
    isolation.storeInSession('session-1', 'Test memory', 'insight');
    const memories = isolation.getSessionMemories('session-1');
    assert.strictEqual(memories.length, 1);
    assert.strictEqual(memories[0].content, 'Test memory');
  });

  it('isolates sessions', () => {
    isolation.storeInSession('session-1', 'Memory 1');
    isolation.storeInSession('session-2', 'Memory 2');
    
    const s1 = isolation.getSessionMemories('session-1');
    const s2 = isolation.getSessionMemories('session-2');
    
    assert.strictEqual(s1.length, 1);
    assert.strictEqual(s1[0].content, 'Memory 1');
    assert.strictEqual(s2.length, 1);
    assert.strictEqual(s2[0].content, 'Memory 2');
  });

  it('purges session memories', () => {
    isolation.storeInSession('session-1', 'Memory 1');
    isolation.storeInSession('session-1', 'Memory 2');
    
    const count = isolation.purgeSession('session-1');
    assert.strictEqual(count, 2);
    assert.strictEqual(isolation.getSessionMemories('session-1').length, 0);
  });

  it('clones memories between sessions', () => {
    isolation.storeInSession('session-1', 'Clone me');
    
    const count = isolation.cloneToSession('session-1', 'session-2');
    assert.strictEqual(count, 1);
    assert.strictEqual(isolation.getSessionMemories('session-2').length, 1);
  });

  it('tracks session statistics', () => {
    isolation.storeInSession('session-1', 'Memory 1', 'failure');
    isolation.storeInSession('session-1', 'Memory 2', 'insight');
    
    const stats = isolation.getSessionStats('session-1');
    assert.strictEqual(stats.count, 2);
    assert.strictEqual(stats.categories.failure, 1);
    assert.strictEqual(stats.categories.insight, 1);
  });
});
