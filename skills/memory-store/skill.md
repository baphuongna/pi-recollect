# memory_store

Store knowledge in persistent memory for future sessions.

## When to use

- After discovering an important gotcha or workaround
- When documenting a project convention
- After making an architectural decision
- When capturing a reusable pattern

## Parameters

- `category` (required): "gotcha" | "convention" | "decision" | "pattern" | "architecture"
- `title` (required): Descriptive title
- `content` (required): Detailed content
- `metadata.files`: Related file paths
- `metadata.tags`: Searchable tags
- `metadata.severity`: "low" | "medium" | "high" | "critical"

## Examples

```
memory_store(category="gotcha", title="Token refresh cache bug", content="TokenManager.refresh() must clear cache before setTokens", metadata={severity: "high", tags: ["auth", "cache"]})
memory_store(category="convention", title="Error handling pattern", content="Use Result<T,E> for all service methods", metadata={tags: ["error-handling", "conventions"]})
```
