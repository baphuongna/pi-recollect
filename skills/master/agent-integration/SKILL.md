---
name: agent-integration
description: Master guide for all extensions working together. Explains how to use pi-recollect, pi-debug, pi-audit, pi-browse, and other extensions to minimize token waste and maximize efficiency.
triggers:
  - memory
  - integrate
  - token optimization
  - efficiency
  - extension
  - work together
  - remember
  - previous
  - similar
  - found before
requirements:
  tools: [memory_store, memory_search, memory_recall, memory_status]
  context: [any task that involves repeated work]
---

# Agent Integration Master Skill

## Overview

All 9 extensions are designed to work **together**, with **pi-recollect** as the central memory hub.

## Golden Rule

```
"Store in memory, search before doing"

BEFORE: Do something (find bug, research, audit)
AFTER:  Store result in memory
NEXT:   Search memory before doing same thing
```

## Extension Integration

| Extension | Integrates with Memory | Purpose |
|-----------|----------------------|---------|
| pi-debug | ✅ Store bug fixes | Remember bugs found |
| pi-audit | ✅ Store security issues | Remember vulnerabilities |
| pi-browse | ✅ Store research | Remember API patterns |
| pi-pipeline | ✅ Store failures | Remember quality issues |
| pi-cicd | ✅ Store deploy issues | Remember deployment problems |
| pi-smart | ✅ Store patterns | Remember code patterns |
| pi-render | ✅ Store decisions | Remember design decisions |
| pi-langsrv | ✅ Store definitions | Remember code structure |

## Token Optimization

Without memory:
- Session 1: Debug bug (2000 tokens)
- Session 2: Debug same bug again (2000 tokens)
- Total: 4000 tokens

With memory:
- Session 1: Debug bug (2000 tokens) + store
- Session 2: Search memory → Found! (50 tokens)
- Total: 2050 tokens

**Savings: ~50% per session!**

## Workflow

```
1. About to do work?
   → memory_search first!

2. Found/Solved something?
   → memory_store immediately!

3. Store categories:
   - gotcha: Common mistakes
   - decision: Architectural choices
   - pattern: Code patterns
   - solution: Fixed problems
   - bug: Bug fixes
   - security: Security findings
```

## Quick Reference

```typescript
// Search before doing
memory_search({ query: "related topic" })

// Store after finding
memory_store({
  category: "bug",
  title: "Brief description",
  content: "What was fixed/found"
})
```

## Remember

- **Store after solving** - Don't lose discovered knowledge
- **Search before starting** - Don't repeat work
- **Use categories** - Keep memory organized
- **Be concise** - Store insights, not raw data
