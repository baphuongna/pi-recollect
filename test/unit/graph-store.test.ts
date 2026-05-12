import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GraphMemoryStore } from '../../src/graph/memory-store.ts';
import path from 'node:path';
import fs from 'node:fs';

describe('GraphMemoryStore', () => {
  let store: GraphMemoryStore;
  const testDbPath = path.join(__dirname, 'test-memory.db');

  beforeEach(() => {
    // Clean up any existing test db
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    store = new GraphMemoryStore(testDbPath, 'test-project');
  });

  afterEach(() => {
    store.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('remember', () => {
    it('should store a memory entry', async () => {
      const entry = await store.remember(
        'API endpoint',
        'Created /api/users endpoint',
        'observation'
      );

      assert.match(entry.id, /^[a-z]+-[a-f0-9]{6}$/);
      assert.strictEqual(entry.key, 'API endpoint');
      assert.strictEqual(entry.value, 'Created /api/users endpoint');
      assert.strictEqual(entry.type, 'observation');
      assert.strictEqual(entry.status, 'active');
    });

    it('should store with tags', async () => {
      const entry = await store.remember('test', 'value', 'task', {
        tags: ['backend', 'api'],
      });

      assert.ok(entry.tags?.includes('backend'));
      assert.ok(entry.tags?.includes('api'));
    });

    it('should generate unique IDs', async () => {
      const entry1 = await store.remember('key1', 'value1');
      const entry2 = await store.remember('key2', 'value2');

      assert.notStrictEqual(entry1.id, entry2.id);
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await store.remember('API design', 'Use REST conventions', 'decision');
      await store.remember('Auth', 'Use JWT tokens', 'decision');
      await store.remember('Database', 'Use PostgreSQL', 'observation');
    });

    it('should query by type', () => {
      const decisions = store.query({ type: 'decision' });
      assert.strictEqual(decisions.length, 2);
      decisions.forEach((d) => assert.strictEqual(d.type, 'decision'));
    });

    it('should query by status', () => {
      const active = store.query({ status: 'active' });
      assert.ok(active.length > 0);
    });

    it('should limit results', () => {
      const limited = store.query({ limit: 1 });
      assert.strictEqual(limited.length, 1);
    });

    it('should offset results', () => {
      const first = store.query({ limit: 1 });
      const second = store.query({ limit: 1, offset: 1 });
      assert.notStrictEqual(first[0].id, second[0].id);
    });
  });

  describe('relate', () => {
    it('should create relationships', async () => {
      const entry1 = await store.remember('task1', 'value1');
      const entry2 = await store.remember('task2', 'value2');

      await store.relate(entry1.id, entry2.id, 'depends_on');

      const related = store.getRelated(entry1.id);
      assert.strictEqual(related.length, 1);
      assert.strictEqual(related[0].id, entry2.id);
    });

    it('should filter relationships by type', async () => {
      const entry1 = await store.remember('task1', 'value1');
      const entry2 = await store.remember('task2', 'value2');
      const entry3 = await store.remember('task3', 'value3');

      await store.relate(entry1.id, entry2.id, 'depends_on');
      await store.relate(entry1.id, entry3.id, 'related_to');

      const depends = store.getRelated(entry1.id, 'depends_on');
      assert.strictEqual(depends.length, 1);
      assert.strictEqual(depends[0].id, entry2.id);
    });
  });

  describe('close', () => {
    it('should close a memory entry', async () => {
      const entry = await store.remember('task', 'value');
      store.close(entry.id);

      const found = store.query({ limit: 100 });
      const closed = found.find((e) => e.id === entry.id);
      assert.strictEqual(closed?.status, 'closed');
    });
  });

  describe('update', () => {
    it('should update memory value', async () => {
      const entry = await store.remember('task', 'original value');
      store.update(entry.id, 'updated value');

      const found = store.query({ limit: 100 });
      const updated = found.find((e) => e.id === entry.id);
      assert.strictEqual(updated?.value, 'updated value');
    });
  });
});
