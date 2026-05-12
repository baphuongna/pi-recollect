import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GraphMemoryStore } from '../../src/graph/memory-store.ts';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('GraphMemoryStore', () => {
  const testDbPath = path.join(__dirname, 'test-memory.db');

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
  });

  it('should store memory entries with remember()', async () => {
    const store = new GraphMemoryStore(testDbPath, 'test-project');
    try {
      const entry = await store.remember('test-key', 'Test value content', 'observation');
      
      assert.ok(entry);
      assert.strictEqual(entry.key, 'test-key');
      assert.strictEqual(entry.value, 'Test value content');
      assert.strictEqual(entry.type, 'observation');
      assert.strictEqual(entry.status, 'active');
      assert.ok(entry.id.startsWith('bd-'));
    } finally {
      store.close();
    }
  });

  it('should query stored entries', async () => {
    const store = new GraphMemoryStore(testDbPath, 'test-project');
    try {
      await store.remember('query-key-1', 'JavaScript programming', 'observation');
      await store.remember('query-key-2', 'Python programming', 'summary');
      
      const results = store.query({});
      assert.ok(results.length >= 2);
    } finally {
      store.close();
    }
  });

  it('should query by type', async () => {
    const store = new GraphMemoryStore(testDbPath, 'test-project');
    try {
      await store.remember('type-obs', 'Observation entry', 'observation');
      await store.remember('type-sum', 'Summary entry', 'summary');
      
      const observations = store.query({ type: 'observation' });
      assert.ok(observations.every(r => r.type === 'observation'));
    } finally {
      store.close();
    }
  });

  it('should add relationships between entries', async () => {
    const store = new GraphMemoryStore(testDbPath, 'test-project');
    try {
      const entry1 = await store.remember('rel-key-1', 'First entry', 'observation');
      const entry2 = await store.remember('rel-key-2', 'Second entry', 'observation');
      
      await store.relate(entry1.id, entry2.id, 'depends_on');
      
      const related = store.getRelated(entry1.id);
      assert.ok(related.length > 0);
      assert.strictEqual(related[0].id, entry2.id);
    } finally {
      store.close();
    }
  });

  it('should update entry value', async () => {
    const store = new GraphMemoryStore(testDbPath, 'test-project');
    try {
      const entry = await store.remember('update-key', 'Original value', 'observation');
      
      store.update(entry.id, 'Updated value');
      
      const results = store.query({});
      const updated = results.find(r => r.id === entry.id);
      assert.ok(updated);
      assert.strictEqual(updated.value, 'Updated value');
    } finally {
      store.close();
    }
  });
});
