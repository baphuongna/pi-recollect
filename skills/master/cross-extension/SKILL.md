---
name: cross-extension
description: Master guide for all extensions working together. Complete integration patterns between pi-langsrv, pi-smart, pi-recollect, pi-debug, pi-audit, pi-browse, pi-pipeline, pi-render, and pi-cicd.
triggers:
  - integrate
  - extension
  - work together
  - combine
  - chain
  - workflow
  - cross
  - lsp + debug
  - audit + browse
  - pipeline + render
requirements:
  tools: [ALL]
  context: [any task requiring multiple capabilities]
---

# Cross-Extension Integration Master Skill

## Overview

All 9 extensions are designed to work **together** in powerful combinations.

## Extension Purposes

| Extension | Primary Role | Key Tools |
|-----------|-------------|-----------|
| pi-langsrv | Code Navigation | lsp_hover, lsp_find_refs, lsp_goto_def |
| pi-smart | Context Optimization | analyze, smart_config |
| pi-recollect | Memory | memory_store, memory_search |
| pi-debug | Runtime Debug | debug_start, debug_variables |
| pi-audit | Security Review | review_diff, review_file |
| pi-browse | Web Research | web_search, web_fetch |
| pi-pipeline | Workflow | pipeline_verify, pipeline_status |
| pi-render | Visual UI | visual_update_plan, visual_show_findings |
| pi-cicd | CI/CD | /ci command |

## Cross-Extension Workflows

### Workflow 1: Security Audit + Web Research

**Extensions:** pi-audit + pi-browse + pi-recollect

```typescript
// 1. Find potential vulnerability
review_diff({ base: "HEAD~1", head: "HEAD" })

// 2. Research CVE for this vulnerability
web_search({ 
  query: "SQL injection express CVE 2024" 
})

// 3. Get fix details
web_fetch({ 
  url: "https://owasp.org/www-community/attacks/SQL_Injection" 
})

// 4. Store for future reference
memory_store({
  category: "security",
  title: "SQL Injection prevention",
  content: "Fix: Use parameterized queries. Tools: mysql2.escape(), SQL.stringify()"
})
```

### Workflow 2: Code Navigation + Debugging

**Extensions:** pi-langsrv + pi-debug

```typescript
// 1. Find all usages of a function
lsp_find_refs({ 
  file: "src/auth.ts", 
  line: 42 
})
// → Found 5 call sites

// 2. See code issues
lsp_diagnostics({ file: "src/auth.ts" })

// 3. Debug at the problematic call site
debug_start({ program: "src/app.ts" })
debug_breakpoint({ file: "src/auth.ts", line: 42 })

// 4. Inspect state
debug_variables({ scope: "locals" })
debug_stack()
```

### Workflow 3: Code Navigation + Security Audit

**Extensions:** pi-langsrv + pi-audit

```typescript
// 1. Find all input handling code
lsp_find_refs({ 
  file: "src/validation.ts", 
  line: 10 
})
// → Found 12 input fields

// 2. Audit each for security
for (const ref of references) {
  review_file({ 
    file: ref.file, 
    context: "full",
    perspectives: ["security"] 
  })
}

// 3. Generate report
review_report({ 
  format: "markdown",
  groupBy: "severity" 
})
```

### Workflow 4: Context Analysis + Pipeline

**Extensions:** pi-smart + pi-pipeline

```typescript
// 1. Analyze codebase complexity
analyze({ 
  files: "src/**/*.ts",
  intent: "complexity" 
})

// 2. Optimize context for pipeline
smart_config({ 
  action: "set",
  key: "focus",
  value: "src/complex/*" 
})

// 3. Run pipeline with optimized context
pipeline_verify({ 
  testCommand: "npm test" 
})

// 4. Monitor status
pipeline_status()
```

### Workflow 5: Security + Debug Verification

**Extensions:** pi-audit + pi-debug + pi-recollect

```typescript
// 1. Find vulnerability
review_diff({ base: "HEAD~1", head: "HEAD" })
// → Found: SQL injection at db.ts:42

// 2. Debug to verify exploitability
debug_start({ program: "src/app.ts" })
debug_breakpoint({ file: "src/db.ts", line: 42 })

// 3. Test the exploit
debug_evaluate({ 
  expression: "userInput + query" 
})
// → Confirmed: SQL injection possible

// 4. Store the finding
memory_store({
  category: "security",
  title: "SQL Injection db.ts:42",
  content: "Verified exploitable. Fix: Use db.query('SELECT * FROM ? WHERE id = ?', [table, id])"
})
```

### Workflow 6: Pipeline + Visual Feedback

**Extensions:** pi-pipeline + pi-render

```typescript
// 1. Show pipeline plan
visual_update_plan({
  title: "Security Review Pipeline",
  status: "DRAFT",
  tasks: [
    { id: "1", description: "Review diff", status: "pending" },
    { id: "2", description: "Audit code", status: "pending" },
    { id: "3", description: "Generate report", status: "pending" }
  ]
})

// 2. Run verification
pipeline_verify({ testCommand: "npm test" })

// 3. Show progress
visual_update_progress({
  phase: "audit",
  completed: 1,
  total: 3,
  currentTask: "Auditing authentication"
})

// 4. Show findings
visual_show_findings({
  findings: [
    { file: "src/auth.ts", severity: "high", message: "Missing rate limiting" }
  ]
})
```

### Workflow 7: CI/CD + Debug

**Extensions:** pi-cicd + pi-debug + pi-recollect

```typescript
// 1. Run CI tests
// /ci run --stage=test

// 2. If failed: debug the failing test
debug_start({ program: "test/auth.test.ts" })
debug_breakpoint({ file: "test/auth.test.ts", line: 42 })

// 3. Find root cause
debug_variables({ scope: "locals" })
debug_evaluate({ expression: "expected" })

// 4. Store the fix
memory_store({
  category: "bug",
  title: "Auth test fix",
  content: "Test expected 'admin' but got 'user'. Fix: Check user.role instead of user.name"
})
```

### Workflow 8: Web Research + Memory

**Extensions:** pi-browse + pi-recollect

```typescript
// 1. Research API
web_search({ query: "Stripe subscription API 2024" })
web_fetch({ url: "https://stripe.com/docs/api/subscriptions" })

// 2. Store findings
memory_store({
  category: "api",
  title: "Stripe Subscription API",
  content: `POST /v1/subscriptions
Body: { customer, items: [{price, quantity}] }
Response: { id, status, customer }`
})

// 3. Next time: just search
memory_search({ query: "Stripe subscription" })
```

### Workflow 9: Code Structure + Analysis

**Extensions:** pi-langsrv + pi-smart

```typescript
// 1. Get code structure
lsp_symbols({ file: "src/**/*.ts" })
// → Get all classes and functions

// 2. Analyze for refactoring
analyze({ 
  files: "src/**/*.ts",
  intent: "refactor-candidates" 
})

// 3. Get details on complex ones
for (const symbol of complexSymbols) {
  lsp_find_refs({ file: symbol.file, line: symbol.line })
  // → Find all usages
}
```

## Integration Decision Tree

```
┌─────────────────────────────────────────────────────────────┐
│                    WHAT ARE YOU DOING?                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
          ┌─────────────────────────────────────────┐
          │ Security Audit?                        │
          │ → Use pi-audit                          │
          │ → Combine with:                         │
          │   - pi-browse (CVE research)           │
          │   - pi-debug (verify exploit)           │
          │   - pi-recollect (store findings)       │
          └─────────────────────────────────────────┘
                            │
          ┌─────────────────────────────────────────┐
          │ Debugging Issue?                         │
          │ → Use pi-debug                          │
          │ → Combine with:                         │
          │   - pi-langsrv (find call sites)        │
          │   - pi-recollect (past bugs)            │
          └─────────────────────────────────────────┘
                            │
          ┌─────────────────────────────────────────┐
          │ Understanding Code?                     │
          │ → Use pi-langsrv                       │
          │ → Combine with:                         │
          │   - pi-smart (complexity analysis)     │
          │   - pi-audit (security review)         │
          └─────────────────────────────────────────┘
                            │
          ┌─────────────────────────────────────────┐
          │ CI/CD Issue?                            │
          │ → Use pi-cicd                          │
          │ → Combine with:                         │
          │   - pi-debug (debug failing tests)     │
          │   - pi-pipeline (orchestrate)           │
          │   - pi-render (show progress)           │
          └─────────────────────────────────────────┘
                            │
          ┌─────────────────────────────────────────┐
          │ Pipeline Run?                           │
          │ → Use pi-pipeline                       │
          │ → Combine with:                         │
          │   - pi-render (visual feedback)         │
          │   - pi-audit (security gate)            │
          │   - pi-smart (optimize context)         │
          └─────────────────────────────────────────┘
```

## Golden Rules

### Rule 1: Combine Understanding + Action
```
pi-langsrv (where is this?) → pi-debug (run it)
pi-langsrv (what calls this?) → pi-audit (is it secure?)
```

### Rule 2: Combine Analysis + Memory
```
pi-browse (research) → pi-recollect (remember)
pi-debug (find bug) → pi-recollect (remember)
pi-audit (find vuln) → pi-recollect (remember)
```

### Rule 3: Combine Execution + Feedback
```
pi-pipeline (run) → pi-render (show progress)
pi-cicd (run) → pi-render (show results)
```

## Common Patterns

### Pattern: Research → Store → Apply
```typescript
// Research
web_search({ query: "best practices React hooks" })

// Store
memory_store({ category: "pattern", title: "React hooks", content: "..." })

// Apply next time
memory_search({ query: "React hooks" })
```

### Pattern: Find → Verify → Fix → Remember
```typescript
// Find issue
review_diff({ base: "HEAD~1", head: "HEAD" })

// Verify with runtime
debug_start({ program: "src/app.ts" })

// Fix code...

// Remember
memory_store({ category: "bug", title: "Fixed issue", content: "..." })
```

### Pattern: Understand → Analyze → Refactor
```typescript
// Understand structure
lsp_symbols({ file: "src/**/*.ts" })

// Analyze complexity
analyze({ files: "src/**/*.ts", intent: "refactor" })

// Refactor
// ... make changes ...
```

## Token Optimization Matrix

| Workflow | Without Integration | With Integration | Savings |
|----------|-------------------|------------------|---------|
| Security Audit | 3000 tokens | 1500 tokens | 50% |
| Debug Issue | 2000 tokens | 1000 tokens | 50% |
| CI/CD Debug | 4000 tokens | 2000 tokens | 50% |
| Research API | 5000 tokens | 2500 tokens | 50% |

## When to Combine Extensions

| Task | Required Extensions |
|------|-------------------|
| Security review | pi-audit + pi-browse + pi-recollect |
| Debug issue | pi-debug + pi-langsrv + pi-recollect |
| CI/CD failure | pi-cicd + pi-debug + pi-recollect |
| Security gate in pipeline | pi-pipeline + pi-audit + pi-render |
| Code analysis | pi-langsrv + pi-smart + pi-recollect |
| Web research | pi-browse + pi-recollect |

## Remember

1. **No extension works alone** - Always consider combinations
2. **Store findings** - Use pi-recollect to remember
3. **Use navigation** - pi-langsrv helps find what to debug/audit
4. **Visual feedback** - Use pi-render for progress
5. **Chain workflows** - One output feeds into the next
