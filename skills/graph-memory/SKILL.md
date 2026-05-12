---
name: graph-memory
description: Store and retrieve memories with semantic relationships and full-text search
triggers:
  - remember
  - recall
  - memory
  - graph
  - what do you know about
  - what have we done
requirements:
  tools: [read, write]
  context: [current project context]
---

# Graph Memory Skill

## Objective
Store and retrieve memories with semantic relationships, full-text search, and automatic semantic decay.

## When to Use
- When the user asks "remember this" or "what do you know about X"
- When tracking decisions, observations, or patterns across sessions
- When searching for previous work on a topic

## Workflow

### Step 1: Determine Memory Type
Classify the memory:
- `observation` - Facts, findings, discovered information
- `decision` - Architectural decisions, choices made
- `summary` - Compacted/summarized entries
- `task` - Work items or TODOs
- `pattern` - Reusable patterns or solutions

### Step 2: Store Memory
```typescript
// Using GraphMemoryStore
const entry = await memory.remember(
  key,        // Short descriptive key
  value,      // Full content
  type,       // Memory type
  { tags }    // Optional tags
);

// Or use natural language
await pi_recollect_remember({ key, value, type, tags });
```

### Step 3: Add Relationships (Optional)
```typescript
// Link related memories
await memory.relate(fromId, toId, 'depends_on');
await memory.relate(fromId, toId, 'related_to');
```

### Step 4: Query Memories
```typescript
// Natural language query
const results = await pi_recollect_query({ 
  query: "authentication implementation" 
});

// Structured query
const results = await memory.query({
  type: 'decision',
  status: 'active',
  limit: 10
});
```

## Output Format
Return structured memory entries:
```json
{
  "entries": [
    {
      "id": "bd-a1b2c3",
      "key": "JWT authentication",
      "value": "Implemented JWT tokens for API auth",
      "type": "decision",
      "status": "active",
      "related": ["bd-d4e5f6"]
    }
  ],
  "count": 1
}
```

## Examples

### Store a Decision
```
User: "Let's use PostgreSQL for the main database"
Agent: 
  await memory.remember(
    "Database choice",
    "Decision: Use PostgreSQL for main database, Redis for cache",
    "decision",
    { tags: ["database", "infrastructure"] }
  )
```

### Query for Context
```
User: "What have we decided about authentication?"
Agent:
  const auth = await memory.query({ 
    query: "authentication" 
  });
  // Returns all auth-related memories
```

### Link Related Memories
```
User: "This API endpoint depends on the auth module"
Agent:
  const api = await memory.remember("GET /api/users", "...");
  const auth = await memory.query({ query: "authentication" })[0];
  await memory.relate(api.id, auth.id, 'depends_on');
```

## Semantic Decay
- Old closed entries (>7 days) are automatically summarized
- Active entries are kept fresh
- Compacted entries retain key insights
- Run decay manually: `await decay.compact()`

## Hash IDs
- Format: `bd-a1b2c3` (conflict-free)
- Hierarchical: `bd-a1b2c3.1.2` (task.subtask)
- IDs are deterministic for same content + time
