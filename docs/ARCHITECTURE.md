# Architecture

## Structure

```
pi-recollect/
├── src/
│   ├── graph/            # Graph-based memory
│   ├── memory/           # Memory management
│   ├── compound/         # Compound memories
│   └── continuity/       # Session continuity
├── skills/
│   └── graph-memory/     # Graph memory skill
└── test/unit/
```

## Core Components

| Component | Purpose |
| --- | --- |
| Graph Store | SQLite-based graph |
| Memory Search | Semantic search |
| Compounding | Combine memories |
| Continuity | Session persistence |
