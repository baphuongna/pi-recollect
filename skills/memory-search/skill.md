# memory_search

Search persistent memory for relevant knowledge, solutions, decisions, and patterns.

## When to use

- When you need to recall past solutions to similar problems
- When looking for project conventions or gotchas
- When investigating decisions made in previous sessions

## Parameters

- `query` (required): Natural language search query
- `maxResults`: Maximum results to return (default: 5)
- `scope`: Filter by "all", "solutions", "decisions", "gotchas", "conventions"
- `detail`: "compact" (title+score), "medium" (preview), "full" (complete content)

## Examples

```
memory_search(query="auth token refresh", detail="medium")
memory_search(query="how to handle errors", scope="gotchas")
memory_search(query="database choice", scope="decisions")
```
