# Shared packages

| Package            | Purpose                                  | Status   |
| ------------------ | ---------------------------------------- | -------- |
| `@dripplex/config` | TS / ESLint / Prettier baselines         | Commit 1 |
| `@dripplex/types`  | Domain types, API contracts, Zod schemas | Commit 4 |
| `@dripplex/utils`  | Pure utilities (formatting, `cn`, phone) | Commit 4 |
| `@dripplex/sdk`    | Typed HTTP client for `/api/v1`          | Commit 4 |
| `@dripplex/ui`     | Design system, shadcn-style components   | Commit 4 |
| `@dripplex/hooks`  | Shared React hooks, providers, theme     | Commit 4 |

All portals import from these packages instead of duplicating UI, validation, and API wiring.

## Build model

| Package | Output                               |
| ------- | ------------------------------------ |
| `types` | `dist/` via `tsc`                    |
| `utils` | `dist/` via `tsc`                    |
| `sdk`   | `dist/` via `tsc`                    |
| `ui`    | Source exports (`transpilePackages`) |
| `hooks` | Source exports (`transpilePackages`) |

## Quality gates

```bash
pnpm --filter @dripplex/types build test lint typecheck
pnpm --filter @dripplex/utils build test lint typecheck
pnpm --filter @dripplex/sdk build test lint typecheck
pnpm --filter @dripplex/ui build lint typecheck
pnpm --filter @dripplex/hooks build lint typecheck
```
