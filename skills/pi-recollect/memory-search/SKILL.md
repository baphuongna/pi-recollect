---
name: memory-search
description: Search persistent memory for relevant knowledge, solutions, decisions, and patterns
triggers:
  - search memory
  - recall
  - what do you remember
  - past solutions
  - similar problem
  - search past
  - find in memory
  - look up
requirements:
  tools: [memory_search]
---

# Memory Search Skill

## Objective
Search persistent memory for relevant knowledge, solutions, decisions, and patterns.

## Tools Available
- `memory_search` - Search persistent memory

## When to Use
- When you need to recall past solutions to similar problems
- When looking for project conventions or gotchas
- When investigating decisions made in previous sessions
- When starting a new task that might have been done before

## Usage

```javascript
memory_search({
  query: "natural language search query",
  maxResults: 5,       // default: 5
  scope: "all",        // default: "all"
  detail: "compact"    // default: "compact"
})
```

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| query | string | Natural language search query |
| maxResults | number | Maximum results (default: 5) |
| scope | string | Filter: all, solutions, decisions, gotchas, conventions |
| detail | string | compact (title+score), medium (preview), full (complete) |

## Scope Options

- `all` - Search everything
- `solutions` - Only solution entries
- `decisions` - Only architectural decisions
- `gotchas` - Only pitfalls and workarounds
- `conventions` - Only coding standards
- `patterns` - Only reusable patterns

## Examples

### Search for Authentication
```
Agent:
  memory_search({ 
    query: "authentication JWT token", 
    maxResults: 5 
  })
```

### Search Decisions Only
```
Agent:
  memory_search({ 
    query: "database choice",
    scope: "decisions" 
  })
```

### Get Full Details
```
Agent:
  memory_search({ 
    query: "retry pattern",
    detail: "full"
  })
```

## Output Format

Returns structured memory entries:
```json
{
  "results": [
    {
      "id": "mem-123",
      "category": "pattern",
      "title": "Retry with Exponential Backoff",
      "score": 0.95,
      "preview": "Use exponential backoff for retry logic...",
      "metadata": {
        "tags": ["reliability", "api"],
        "severity": "medium"
      }
    }
  ]
}
```
