# pi-recollect Agent Operating Guide

## Extension Purpose

pi-recollect provides persistent memory, graph-based knowledge storage, and semantic search for Pi coding agents.

## Source Of Truth

1. `README.md` - Extension overview
2. `skills/graph-memory/SKILL.md` - Graph memory skill
3. `skills/memory-search/SKILL.md` - Memory search skill
4. `skills/memory-store/SKILL.md` - Memory store skill
5. `skills/compound-note/SKILL.md` - Knowledge compounding skill
6. `docs/HARNESS.md` - Operating model
7. `docs/FEATURE_INTAKE.md` - Intake process
8. `docs/product/` - Product contracts
9. `docs/stories/` - Story packets
10. `docs/TEST_MATRIX.md` - Proof status
11. `docs/decisions/` - Decision records

## Extension Capabilities

### Core Tools
- `memory_search` - Search persistent memory
- `memory_store` - Store knowledge in memory
- `memory_recall` - Recall relevant memories
- `memory_status` - Get memory status

### Skills
- `skills/graph-memory/SKILL.md` - Semantic relationships, full-text search
- `skills/memory-search/SKILL.md` - Memory search with filters
- `skills/memory-store/SKILL.md` - Knowledge categorization
- `skills/compound-note/SKILL.md` - Session summarization

## When to Use This Extension

- Storing knowledge across sessions
- Searching for past solutions
- Documenting decisions
- Memory compounding

## Validation Commands

```bash
npm test
npm run lint
npx tsc --noEmit
```
