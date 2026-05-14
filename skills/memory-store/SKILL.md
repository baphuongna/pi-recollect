---
name: memory-store
description: Store knowledge in persistent memory - gotchas, conventions, decisions, patterns, architecture
triggers:
  - remember this
  - store knowledge
  - document convention
  - save pattern
  - record decision
  - this is important
  - don't forget
  - for future reference
  - capture
requirements:
  tools: [memory_store]
---

# Memory Store Skill

## Objective
Store knowledge in persistent memory for future sessions.

## Tools Available
- `memory_store` - Store knowledge in memory

## When to Use
- After discovering an important gotcha or workaround
- When documenting a project convention
- After making an architectural decision
- When capturing a reusable pattern
- When user says "remember this" or "don't forget"

## Usage

```javascript
memory_store({
  category: "gotcha" | "convention" | "decision" | "pattern" | "architecture",
  title: "Descriptive title",
  content: "Detailed content...",
  metadata: {
    files: ["src/**"],
    tags: ["tag1", "tag2"],
    severity: "low" | "medium" | "high" | "critical"
  }
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

## Examples

### Store a Gotcha
```
Agent:
  memory_store({
    category: "gotcha",
    title: "npm install fails on M1 Mac",
    content: "When running npm install on M1 Mac, use `npm install --legacy-peer-deps`",
    metadata: { 
      tags: ["npm", "mac", "m1"],
      severity: "high"
    }
  })
```

### Store a Decision
```
Agent:
  memory_store({
    category: "decision",
    title: "PostgreSQL for main database",
    content: "Decision: Use PostgreSQL for main database, Redis for cache. PostgreSQL chosen for ACID compliance and JSON support.",
    metadata: { 
      files: ["docker-compose.yml", "src/db/**"],
      tags: ["database", "postgresql"]
    }
  })
```

### Store a Pattern
```
Agent:
  memory_store({
    category: "pattern",
    title: "Retry with Exponential Backoff",
    content: "For API calls that may fail transiently:\n1. Wait 1 second\n2. Retry\n3. Wait 2 seconds\n4. Retry\n5. Wait 4 seconds\n6. Final retry",
    metadata: { tags: ["reliability", "api"] }
  })
```

### Store a Convention
```
Agent:
  memory_store({
    category: "convention",
    title: "API Response Format",
    content: "All API responses should use: { data, error, meta }",
    metadata: { files: ["src/api/**"] }
  })
```

## Metadata Fields

| Field | Type | Description |
|-------|------|-------------|
| files | string[] | Related file paths |
| tags | string[] | Searchable tags |
| severity | string | low, medium, high, critical |

## Best Practices
1. Be specific with titles
2. Include code examples when relevant
3. Add related file paths
4. Use appropriate tags
5. Set severity appropriately
