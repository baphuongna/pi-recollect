/**
 * Graph Store Tests
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

import {
  createGraphStore,
  generateHashId,
} from '../../src/graph/graph-store.ts';

describe('GraphStore', () => {
  let store: ReturnType<typeof createGraphStore>;
  
  beforeEach(() => {
    store = createGraphStore();
  });
  
  describe('generateHashId', () => {
    it('should generate id with prefix', () => {
      const id = generateHashId("test");
      assert.ok(id.startsWith("test-"));
      assert.strictEqual(id.length, "test-xxxxxxxx".length);
    });
    
    it('should generate unique ids', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateHashId());
      }
      assert.strictEqual(ids.size, 100);
    });
  });
  
  describe('addNode', () => {
    it('should add node with generated id', () => {
      const node = store.addNode({
        type: "issue",
        title: "Test Issue",
      });
      
      assert.ok(node.id.startsWith("issu"));
      assert.strictEqual(node.title, "Test Issue");
      assert.ok(node.createdAt);
      assert.ok(node.updatedAt);
    });
    
    it('should generate unique ids', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const node = store.addNode({ type: "task", title: `Task ${i}` });
        ids.add(node.id);
      }
      assert.strictEqual(ids.size, 10);
    });
  });
  
  describe('getNode', () => {
    it('should return node by id', () => {
      const node = store.addNode({ type: "memory", title: "Test" });
      const found = store.getNode(node.id);
      assert.strictEqual(found?.title, "Test");
    });
    
    it('should return undefined for missing id', () => {
      assert.strictEqual(store.getNode("missing"), undefined);
    });
  });
  
  describe('closeNode', () => {
    it('should close node', () => {
      const node = store.addNode({ type: "task", title: "Test" });
      const closed = store.closeNode(node.id);
      assert.strictEqual(closed?.closed, true);
    });
  });
  
  describe('addRelation', () => {
    it('should add relation', () => {
      const node1 = store.addNode({ type: "issue", title: "Issue 1" });
      const node2 = store.addNode({ type: "task", title: "Task" });
      
      store.addRelation(node1.id, { type: "relates_to", targetId: node2.id });
      
      const relations = store.getRelations(node1.id);
      assert.strictEqual(relations.length, 1);
      assert.strictEqual(relations[0].type, "relates_to");
    });
  });
  
  describe('getRelatedNodes', () => {
    it('should return related nodes', () => {
      const node1 = store.addNode({ type: "issue", title: "Issue 1" });
      const node2 = store.addNode({ type: "task", title: "Task" });
      
      store.addRelation(node1.id, { type: "blocks", targetId: node2.id });
      
      const related = store.getRelatedNodes(node1.id);
      assert.strictEqual(related.length, 1);
      assert.strictEqual(related[0].title, "Task");
    });
  });
  
  describe('query', () => {
    it('should filter by type', () => {
      store.addNode({ type: "issue", title: "Issue" });
      store.addNode({ type: "task", title: "Task" });
      store.addNode({ type: "task", title: "Task 2" });
      
      const tasks = store.query({ type: "task" });
      assert.strictEqual(tasks.length, 2);
    });
    
    it('should filter by closed', () => {
      const open = store.addNode({ type: "task", title: "Open" });
      store.addNode({ type: "task", title: "Closed" });
      store.closeNode(open.id);
      
      const closed = store.query({ closed: true });
      assert.strictEqual(closed.length, 1);
    });
  });
});
