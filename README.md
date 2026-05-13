# pi-recollect

Memory and context management extension for coding agents.

## Features

- **Graph Memory** - Hash-based ID memory with dependencies
- **Context Compaction** - Session compaction for long conversations
- **Memory Decay** - Semantic summarization of old content
- **Progressive Disclosure** - Layered context presentation
- **Session Continuity** - Seamless session recovery

## Installation

```bash
npm install pi-recollect
```

## Usage

### Commands

- `/remember [insight]` - Store insight in graph memory
- `/recall [topic]` - Recall related memories
- `/compact` - Compact session context
- `/forget [id]` - Remove from memory

### Graph Store

```typescript
import { createGraphStore, generateHashId } from 'pi-recollect';

const store = createGraphStore();

// Add memory node
const node = store.addNode({
  type: 'insight',
  title: 'Important finding',
  content: '...',
  relations: [{ type: 'relates_to', targetId: otherNode.id }],
});

// Query memories
const insights = store.query({ type: 'insight', closed: false });
```

## Architecture

```
src/
├── graph/
│   ├── graph-store.ts     # Graph memory
│   ├── hash-id.ts         # Hash-based IDs
│   ├── memory-store.ts    # Memory persistence
│   └── decay.ts           # Memory decay
├── context/
│   └── context-saver.ts   # Context management
├── session/
│   └── session-continuity.ts
└── index.ts
```

## Patterns Applied

- Hash-based IDs from beads
- Graph memory from beads
- Memory categories from pi-hermes-memory
- Context compaction from oh-my-pi
- Memory decay from beads

## License

MIT
