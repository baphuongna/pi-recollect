# Command Reference - pi-recollect

## Slash Commands

### /memory
Main memory command.

```bash
/memory <subcommand> [options]
```

### /memory store
Store new memory.

```bash
/memory store <content> [options]
```

#### Options

| Option | Description |
|--------|-------------|
| `--tags` | Comma-separated tags |
| `--priority` | high/normal/low |
| `--expires` | Auto-delete duration |

### /memory search
Search memories.

```bash
/memory search <query> [options]
```

#### Options

| Option | Description |
|--------|-------------|
| `--tags` | Filter by tags |
| `--priority` | Filter by priority |
| `--limit` | Max results |
| `--fuzzy` | Enable fuzzy matching |

### /memory recall
Recall session context.

```bash
/memory recall [options]
```

#### Options

| Option | Description |
|--------|-------------|
| `--session` | Specific session ID |
| `--recent` | Recent sessions only |

### /memory list
List memories.

```bash
/memory list [options]
```

#### Options

| Option | Description |
|--------|-------------|
| `--tags` | Filter by tags |
| `--status` | active/archived |
| `--limit` | Max results |

### /memory get
Get specific memory.

```bash
/memory get <id>
```

### /memory update
Update memory.

```bash
/memory update <id> <content>
```

### /memory delete
Delete memory.

```bash
/memory delete <id>
```

### /memory link
Link memories.

```bash
/memory link <id> --to <id> --type=<type>
```

### /memory graph
Show memory graph.

```bash
/memory graph [id]
```

### /memory archive
Archive old memories.

```bash
/memory archive [options]
```

### /memory save-session
Save current session.

```bash
/memory save-session
```

### /memory resume
Resume last session.

```bash
/memory resume
```

## Tools

### memory_store

```javascript
memory_store({
  content: "Memory text",
  tags: ["tag1", "tag2"],
  priority: "normal",
  expires: "7d"
})
```

### memory_search

```javascript
memory_search({
  query: "authentication",
  tags: ["security"],
  limit: 10,
  fuzzy: false
})
```

### memory_recall

```javascript
memory_recall({
  sessionId: "session-123"
})
```

### memory_list

```javascript
memory_list({
  status: "active",
  tags: ["important"],
  limit: 20
})
```

### memory_graph

```javascript
memory_graph({
  memoryId: "mem-123",
  depth: 2
})
```
