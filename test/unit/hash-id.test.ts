import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateHashId,
  generateHierarchicalId,
  parseHierarchicalId,
  isValidHashId,
  generateShortId,
} from '../../src/graph/hash-id.ts';

describe('Hash ID Generation', () => {
  describe('generateHashId', () => {
    it('should generate ID in bd-xxxx format', () => {
      const id = generateHashId('test content');
      assert.match(id, /^bd-[a-f0-9]{6}$/);
    });

    it('should generate unique IDs for different content', () => {
      const id1 = generateHashId('content 1');
      const id2 = generateHashId('content 2');
      assert.notStrictEqual(id1, id2);
    });

    it('should respect custom prefix', () => {
      const id = generateHashId('test', 'task');
      assert.match(id, /^task-[a-f0-9]{6}$/);
    });
  });

  describe('generateHierarchicalId', () => {
    it('should append index to parent ID', () => {
      const id = generateHierarchicalId('bd-a1b2c3', 1);
      assert.strictEqual(id, 'bd-a1b2c3.1');
    });

    it('should support multiple levels', () => {
      const id = generateHierarchicalId('bd-a1b2c3.1', 2);
      assert.strictEqual(id, 'bd-a1b2c3.1.2');
    });
  });

  describe('parseHierarchicalId', () => {
    it('should parse simple ID', () => {
      const parsed = parseHierarchicalId('bd-a1b2c3');
      assert.strictEqual(parsed.epic, 'bd-a1b2c3');
      assert.strictEqual(parsed.task, undefined);
      assert.strictEqual(parsed.subtask, undefined);
    });

    it('should parse two-level ID', () => {
      const parsed = parseHierarchicalId('bd-a1b2c3.1');
      assert.strictEqual(parsed.epic, 'bd-a1b2c3');
      assert.strictEqual(parsed.task, 1);
      assert.strictEqual(parsed.subtask, undefined);
    });

    it('should parse three-level ID', () => {
      const parsed = parseHierarchicalId('bd-a1b2c3.1.2');
      assert.strictEqual(parsed.epic, 'bd-a1b2c3');
      assert.strictEqual(parsed.task, 1);
      assert.strictEqual(parsed.subtask, 2);
    });
  });

  describe('isValidHashId', () => {
    it('should validate correct IDs', () => {
      assert.strictEqual(isValidHashId('bd-a1b2c3'), true);
      assert.strictEqual(isValidHashId('task-abc123'), true);
      assert.strictEqual(isValidHashId('bd-a1b2c3.1'), true);
    });

    it('should reject invalid IDs', () => {
      assert.strictEqual(isValidHashId('invalid'), false);
      assert.strictEqual(isValidHashId('bd-'), false);
      assert.strictEqual(isValidHashId(''), false);
    });
  });

  describe('generateShortId', () => {
    it('should generate 4-character ID', () => {
      const id = generateShortId('test');
      assert.strictEqual(id.length, 4);
    });

    it('should be deterministic for same input', () => {
      const id1 = generateShortId('same content');
      const id2 = generateShortId('same content');
      assert.strictEqual(id1, id2);
    });
  });
});
