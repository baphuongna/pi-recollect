# Configuration - pi-recollect

## Configuration File

Create `pi-recollect.config.json`:

```json
{
  "storage": {
    "type": "sqlite",
    "path": ".pi/memory.db",
    "fts": true,
    "ftsAlgorithm": "bm25"
  },
  "memory": {
    "maxPerSession": 1000,
    "defaultPriority": "normal",
    "defaultExpires": "30d",
    "autoArchive": true,
    "archiveAfter": "90d"
  },
  "search": {
    "defaultLimit": 20,
    "fuzzyEnabled": true,
    "fuzzyThreshold": 0.6,
    "relevanceThreshold": 0.3
  },
  "decay": {
    "enabled": true,
    "highImportance": "never",
    "normalImportance": "90d",
    "lowImportance": "30d"
  },
  "graph": {
    "enabled": true,
    "maxDepth": 3
  },
  "session": {
    "autoSave": true,
    "saveInterval": 300000,
    "maxSessions": 50
  },
  "context": {
    "autoInject": true,
    "maxMemories": 5,
    "relevanceThreshold": 0.5
  }
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PI_MEMORY_DB` | Database path | .pi/memory.db |
| `PI_MEMORY_LIMIT` | Max memories | 1000 |

## Storage

### SQLite (Default)

```json
{
  "storage": {
    "type": "sqlite",
    "path": ".pi/memory.db"
  }
}
```

### Memory Only

```json
{
  "storage": {
    "type": "memory"
  }
}
```

## Search Configuration

```json
{
  "search": {
    "fuzzyEnabled": true,
    "fuzzyThreshold": 0.6,
    "stemming": true,
    "stopWords": ["the", "a", "an"]
  }
}
```

## Decay Configuration

```json
{
  "decay": {
    "enabled": true,
    "schedule": "daily",
    "thresholds": {
      "high": 365,
      "normal": 90,
      "low": 30
    }
  }
}
```
