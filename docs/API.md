# pi-recollect API Reference

## Graph Store

```typescript
import { createGraphStore, generateHashId } from 'pi-recollect';

const store = createGraphStore();

// Add nodes
const issue = store.addNode({
  type: 'issue',
  title: 'Bug in auth',
  content: 'Token expiry check wrong',
  relations: [],
});

const task = store.addNode({
  type: 'task',
  title: 'Fix auth',
  relations: [{ type: 'blocks', targetId: issue.id }],
});

// Query
const insights = store.query({ type: 'insight' });
const tasks = store.query({ type: 'task', closed: false });

// Get related
const related = store.getRelatedNodes(issue.id);
const relations = store.getRelations(issue.id);

// Close and compact
store.closeNode(issue.id);
store.compact(new Date('2024-01-01'));
```

## Hash IDs

```typescript
import { generateHashId } from 'pi-recollect';

const id = generateHashId('issue');
// "issue-a1b2c3d4"

const id2 = generateHashId();
// "node-e5f6g7h8"
```

## Memory Decay

```typescript
import { createMemoryDecay } from 'pi-recollect';

const decay = createMemoryDecay({
  decayThreshold: 30 * 24 * 60 * 60 * 1000, // 30 days
  minImportance: 0.5,
});

decay.record(node);
const shouldDecay = decay.shouldDecay(node);
const summary = decay.summarize(node);
```
