---
description: How to build and test a single package in isolation
---

# Build Package

1. Navigate context to the target package:

```
Read the CLAUDE.md for project context.
Read docs/architecture.md for the relevant interfaces.
Read the ticket file in docs/tickets/ for the specific task.
```

1. Check if core types exist. If working on anything other than `core`, first read:

```
packages/core/src/types/index.ts
```

These are the shared types all packages depend on. Use them, don't redefine.

1. Implement the code in the package's `src/` directory.

2. Write tests alongside the source file: `foo.ts` → `foo.test.ts`

3. Run the tests:

```bash
cd /home/hyprayush/Documents/Projects/openagents/strategyforge
pnpm --filter @strategyforge/<PACKAGE_NAME> test
```

1. If tests pass, confirm the barrel export in `src/index.ts` exports all public interfaces.

## Rules

- Do NOT modify files in other packages
- Do NOT add dependencies without checking if they're already in the workspace root
- Use `@strategyforge/core` for shared types (add as workspace dependency if needed)
- Every exported function needs explicit return type
- No `any` — use `unknown` + type guards
