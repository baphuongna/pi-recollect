---
name: compound-note
description: Knowledge compounding - automatically document solutions, patterns, and decisions at session shutdown
triggers:
  - compound
  - solution
  - document pattern
  - session summary
  - shutdown
  - auto-document
requirements:
  tools: [memory_store, memory_recall]
---

# Compound Note Skill

## Objective
Automatically document solutions, patterns, and decisions through knowledge compounding at session shutdown.

## Tools Available
- `memory_store` - Store knowledge in memory
- `memory_recall` - Recall relevant memories

## When to Use
- At session shutdown
- When summarizing work done
- When capturing discovered patterns
- When documenting solutions to problems

## How It Works

1. **Session events** (errors, edits, decisions) are tracked automatically
2. **At session shutdown**, events are analyzed for patterns
3. **Findings** are routed as bug/knowledge/decision solutions
4. **Duplicate solutions** are merged
5. **New solutions** are written to `.pi-recall/solutions/`
6. **PI_MEMORY.md** is updated with the latest summary

## Automatic Documentation

### Tracked Events
- Compilation errors and fixes
- Important code changes
- Decisions made
- Problems solved
- Patterns discovered

### Compound Actions
- Session summary generation
- Pattern extraction
- Duplicate detection
- Solution indexing

## Examples

### Session Summary
```
User: End session
Agent:
  1. Analyze session events
  2. memory_store for key findings
  3. Update PI_MEMORY.md
```

### Manual Compound Note
```
Agent:
  memory_store({
    category: "pattern",
    title: "Session: Authentication Solution",
    content: "Discovered solution: Use JWT with refresh tokens for session management"
  })
```

## Output Files

| File | Description |
|------|-------------|
| `.pi-recall/solutions/*.yaml` | Individual solution files |
| `.pi-recall/PI_MEMORY.md` | Session summary |
| `.pi-recall/index.json` | Solution index |

## YAML Solution Format
```yaml
category: pattern
title: "Solution title"
body: |
  Detailed explanation
tags: [tag1, tag2]
created: 2024-01-15
session: session-id
```

## Integration
Works with `memory_store` and `memory_search` for persistent knowledge management.
