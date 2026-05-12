# compound-note

Knowledge compounding: automatically document solutions, patterns, and decisions.

## When to use

- At session shutdown, pi-recall automatically analyzes the session
- Manual compound notes can be triggered via memory_store with appropriate categories
- When you want to explicitly capture a solution for future reference

## How it works

1. Session events (errors, edits, decisions) are tracked automatically
2. At session shutdown, events are analyzed for patterns
3. Findings are routed as bug/knowledge/decision solutions
4. Duplicate solutions are merged; new ones are written to .pi-recall/solutions/
5. PI_MEMORY.md is updated with the latest summary

## YAML solution format

Solutions are stored in `.pi-recall/solutions/` with YAML frontmatter:

```yaml
type: bug|knowledge|decision
title: "..."
created: YYYY-MM-DD
---
problem: |
  ...
fix: |
  ...
```
