# Quick Start - pi-recollect

## Installation

```bash
pi install npm:pi-recollect
```

## Basic Usage

### Remember Insight

```bash
/remember JWT tokens expire after 24h
```

### Recall Memories

```bash
/recall authentication patterns
```

### Compact Context

```bash
/compact
```

## Graph Store

```typescript
import { createGraphStore } from 'pi-recollect';

const store = createGraphStore();

// Add insights
const insight = store.addNode({
  type: 'insight',
  title: 'JWT best practices',
  content: 'Use RS256 algorithm',
});

store.addRelation(insight.id, {
  type: 'relates_to',
  targetId: authInsight.id,
});

// Query
const insights = store.query({ type: 'insight' });
```

## Memory Decay

```typescript
import { createMemoryDecay } from 'pi-recollect';

const decay = createMemoryDecay({
  decayThreshold: 30 * 24 * 60 * 60 * 1000,
});

// Check if should decay
if (decay.shouldDecay(node)) {
  const summary = decay.summarize(node);
  store.updateNode(node.id, { content: summary });
}
```

## Next Steps

- Read [API.md](API.md) for full API reference
- Check [SPEC.md](../SPEC.md) for feature details
