# pi-recollect

Persistent memory extension for Pi coding agents.

## Features

- **Memory Store** - SQLite-backed persistent memory
- **Semantic Search** - FTS5/BM25 search across memories
- **Session Continuity** - Continue from where you left off
- **Knowledge Compounding** - Store lessons learned
- **Graph Memory** - Hash-based graph relationships
- **Memory Decay** - Age out old memories
- **Context Saving** - Save context between sessions
- **Session Isolation** - Separate memories per session

## Install

```bash
pi install npm:pi-recollect
```

## Quick Start

### Store Memory
```bash
/memory store "Important: Use auth middleware for /api routes"
```

### Search Memory
```bash
/memory search authentication
```

### Recall Context
```bash
/memory recall
```

### List Memories
```bash
/memory list
```

## Commands

| Command | Description |
|---------|-------------|
| `/memory` | Memory main command |
| `/memory store` | Store new memory |
| `/memory search` | Search memories |
| `/memory recall` | Recall context |

## Verify

```bash
pi list
```

## License

MIT
