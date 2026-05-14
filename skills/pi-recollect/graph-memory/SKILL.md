---
name: graph-memory
description: Store and retrieve memories with semantic relationships, full-text search, and automatic semantic decay
triggers:
  - remember
  - recall
  - memory
  - graph
  - what do you know about
  - what have we done
  - past decisions
  - learned
requirements:
  tools: [memory_search, memory_store, memory_recall, memory_status]
  context: [project context]
---

# Graph Memory Skill

## Objective
Store and retrieve memories with semantic relationships, full-text search, and automatic semantic decay for maintaining context across sessions.

## Tools Available
- `memory_search` - Search persistent memory for relevant knowledge
- `memory_store` - Store knowledge in persistent memory
- `memory_recall` - Recall relevant memories with progressive disclosure
- `memory_status` - Get memory status and statistics

## When to Use
- When the user asks "remember this" or "what do you know about X"
- When tracking decisions, observations, or patterns across sessions
- When searching for previous work on a topic
- When you need context from past sessions

## Tool Usage

### memory_search
```javascript
memory_search({
  query: "authentication implementation",
  maxResults: 5,
  scope: "all" | "solutions" | "decisions" | "gotchas" | "conventions",
  detail: "compact" | "medium" | "full"
})
```

### memory_store
```javascript
memory_store({
  category: "gotcha" | "convention" | "decision" | "pattern" | "architecture",
  title: "JWT Authentication Pattern",
  content: "Detailed explanation...",
  metadata: {
    files: ["src/auth/**"],
    tags: ["auth", "jwt"],
    severity: "high"
  }
})
```

### memory_recall
```javascript
memory_recall({
  context: "working on authentication",
  budget: 2048
})
```

### memory_status
```javascript
memory_status({
  action: "status" | "stats" | "reindex" | "compact"
})
```

## Categories

| Category | Description | Example |
|----------|-------------|---------|
| gotcha | Pitfalls and workarounds | "npm install fails on M1" |
| convention | Coding standards | "Use camelCase for functions" |
| decision | Architectural choices | "PostgreSQL over MongoDB" |
| pattern | Reusable solutions | "Retry with exponential backoff" |
| architecture | System design | "Microservices over monolith" |

## Semantic Graph

Memories can be linked:
- `depends_on` - Dependency relationship
- `related_to` - General relationship
- `implements` - Implementation relationship
- `supersedes` - Newer version of

## Examples

### Store a Decision
```
User: Let's use PostgreSQL for the main database
Agent:
  memory_store({
    category: "decision",
    title: "Database choice: PostgreSQL",
    content: "Decision: Use PostgreSQL for main database, Redis for cache",
    metadata: { tags: ["database", "infrastructure"] }
  })
```

### Recall Past Context
```
User: What were we working on last time?
Agent:
  memory_recall({
    context: "current project"
  })
```

### Search for Solutions
```
User: How did we handle auth before?
Agent:
  memory_search({
    query: "authentication",
    scope: "decisions"
  })
```

### Check Memory Health
```
Agent:
  memory_status({ action: "stats" })
```

## Semantic Decay
- Old closed entries (>7 days) are automatically summarized
- Active entries are kept fresh
- Compacted entries retain key insights
- Run decay: `memory_status({ action: "compact" })`

## Hash IDs
- Format: `bd-a1b2c3` (conflict-free)
- Hierarchical: `bd-a1b2c3.1.2` (task.subtask)
- IDs are deterministic for same content + time
