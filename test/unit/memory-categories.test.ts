import assert from "node:assert/strict";
import test from "node:test";
import { 
  MEMORY_CATEGORY_DESCRIPTIONS, 
  CATEGORY_COLORS,
  formatMemoryContent,
  parseCategory
} from "../../src/categories/memory-categories.ts";

test("MEMORY_CATEGORY_DESCRIPTIONS has all categories", () => {
  const categories = [
    'observation', 'summary', 'decision', 'pattern', 'task',
    'failure', 'correction', 'insight', 'preference', 'convention', 'tool-quirk'
  ];
  
  for (const cat of categories) {
    assert.ok(MEMORY_CATEGORY_DESCRIPTIONS[cat as keyof typeof MEMORY_CATEGORY_DESCRIPTIONS]);
  }
});

test("CATEGORY_COLORS has all categories", () => {
  const categories = [
    'observation', 'summary', 'decision', 'pattern', 'task',
    'failure', 'correction', 'insight', 'preference', 'convention', 'tool-quirk'
  ];
  
  for (const cat of categories) {
    assert.ok(CATEGORY_COLORS[cat as keyof typeof CATEGORY_COLORS]);
  }
});

test("formatMemoryContent formats correctly", () => {
  const result = formatMemoryContent('Test content', 'observation');
  assert.strictEqual(result, '[observation] Test content');
});

test("formatMemoryContent with failure reason", () => {
  const result = formatMemoryContent(
    'Tried X approach',
    'failure',
    { failureReason: 'X is deprecated' }
  );
  assert.ok(result.includes('[failure]'));
  assert.ok(result.includes('Tried X approach'));
  assert.ok(result.includes('Failed: X is deprecated'));
});

test("parseCategory extracts category", () => {
  const { category, content } = parseCategory('[failure] Something went wrong');
  assert.strictEqual(category, 'failure');
  assert.strictEqual(content, 'Something went wrong');
});

test("parseCategory returns null for unknown category", () => {
  const { category, content } = parseCategory('[unknown] Something');
  assert.strictEqual(category, null);
  assert.strictEqual(content, '[unknown] Something');
});

test("parseCategory returns null for untagged content", () => {
  const { category } = parseCategory('Just some text');
  assert.strictEqual(category, null);
});
