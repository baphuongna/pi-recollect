# pi-recollect Agent Operating Guide

## Extension Purpose

pi-recollect provides persistent memory, semantic search, and graph-based knowledge management for Pi coding agents.

## Source Of Truth

1. `README.md` - Extension overview
2. `docs/HARNESS.md` - Operating model
3. `docs/FEATURE_INTAKE.md` - Intake process
4. `docs/product/` - Product contracts
5. `docs/stories/` - Story packets
6. `docs/TEST_MATRIX.md` - Proof status
7. `docs/decisions/` - Decision records

## Extension Capabilities

### Core Tools
- `memory_search` - Search persistent memory
- `memory_store` - Store knowledge
- `memory_recall` - Recall memories
- `memory_status` - Get memory status
- `graph_memory` - Graph-based memory

### Skills
- `graph-memory` - Semantic relationships and full-text search

## Validation Commands

```bash
npm test
npm run lint
npx tsc --noEmit
```
