# User Guide - pi-recollect

## Overview

pi-recollect provides persistent memory for Pi coding agents with SQLite storage and semantic search.

## Memory Types

### Simple Memory
Basic key-value storage:

```bash
/memory store "Use feature flags for new features"
```

### Tagged Memory
Categorized with tags:

```bash
/memory store "Use TypeScript strict mode" --tags=typescript,quality
```

### Priority Memory
Important memories with high priority:

```bash
/memory store "CRITICAL: Database password exposed" --priority=high
```

### Expiring Memory
Auto-delete after time:

```bash
/memory store "Temp: Fix expires in 1 hour" --expires=1h
```

## Search

### Keyword Search
```bash
/memory search authentication
```

### Semantic Search
```bash
/memory search "user authentication best practices"
```

### Filtered Search
```bash
/memory search auth --tags=security --priority=high
```

### Fuzzy Search
```bash
/memory search "authentcation" --fuzzy
```

## Graph Memory

### Relationships

```bash
/memory link mem-123 --to mem-456 --type="implements"
```

### Graph Query

```bash
/memory graph mem-123

Output:
## Memory Graph

mem-123: "Auth middleware"
├── implements → mem-456: "Auth interface"
├── requires → mem-789: "JWT service"
└── used-by → mem-111: "API routes"
```

## Memory Decay

Old memories automatically age:

| Age | Importance | Action |
|-----|------------|--------|
| < 1 week | High | Full relevance |
| 1-4 weeks | Medium | Reduced relevance |
| > 1 month | Low | Minimal relevance |
| > 3 months | Very low | Archived |

### Manual Decay

```bash
# Archive old memories
/memory archive --older-than=30d

# Restore archived
/memory restore mem-123
```

## Session Continuity

### Save Session

```bash
/memory save-session

Output:
## Session Saved

Tasks completed: 5
Key decisions: 3
Open questions: 2
Context size: 45KB
```

### Resume Session

```bash
/memory resume

Output:
## Resuming Session

Last session: 2 hours ago
Project: my-app
Resuming: Task #6 of "Implement auth"
```

## Context Injection

Memories automatically injected:

```
## Relevant Memories

1. "Use auth middleware for /api routes" (from: Session 12)
2. "JWT tokens in httpOnly cookie" (from: Session 8)
```

## Best Practices

1. **Be specific** - Clear, actionable memories
2. **Tag properly** - Easy retrieval later
3. **Set priorities** - Important = high priority
4. **Regular review** - Clean up old memories
5. **Link related** - Build knowledge graph
