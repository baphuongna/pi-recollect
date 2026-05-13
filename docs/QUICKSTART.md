# Quick Start - pi-recollect

## Installation

```bash
pi install npm:pi-recollect
```

## Basic Usage

### 1. Store Memory

```bash
/memory store "Use auth middleware for all /api routes"

Output:
✅ Memory stored (id: mem-123)
Tags: []
Importance: normal
```

### 2. Search Memory

```bash
/memory search auth

Output:
## Memories (3 found)

1. **Use auth middleware** (relevance: 0.95)
   "Use auth middleware for all /api routes"
   
2. **JWT tokens** (relevance: 0.78)
   "Store JWT in httpOnly cookie"
   
3. **Password hashing** (relevance: 0.65)
   "Use bcrypt with cost 12"
```

### 3. Recall Context

```bash
/memory recall

Output:
## Session Context

Last session: 2 hours ago
Project: my-app
Last task: Implemented authentication

Key memories:
- Use auth middleware for /api routes
- JWT tokens in httpOnly cookie
```

### 4. List Memories

```bash
/memory list

Output:
## All Memories (42)

Recent:
- mem-42: "API response format" (5 min ago)
- mem-41: "Database schema changes" (1 hour ago)
- mem-40: "Auth implementation" (2 hours ago)
```
