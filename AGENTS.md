# Agent Guidelines

## Project

- Library: `react-router-auto-routes` generates React Router v7 route configs from file-system structure.
- Core entry: `src/core/index.ts` exports `autoRoutes(options)`; default export is same.
- Legacy migration helpers live under `src/migration` for backwards compatibility with `remix-flat-routes`.
- Codebase is ESM-only and targets Node 22+.

## Important Modules

- `src/core/routing/*`: detection, metadata collection, path building, normalization, and tree assembly.
- `src/utils.ts`: shared helpers (`defaultVisitFiles`, memoized regex, route id normalization).
- `src/migration/route-scanner.ts`: filesystem crawl + ignore handling for legacy migrations.
- `src/migration/normalizers.ts`: legacy route ID and colocated path normalization.
- `src/migration/*`: migration workflow and CLI compatibility for older Remix setups.

## Route Conventions

- Route conventions: param char defaults to `$`, colocation prefix `+`, optional segments `(...)`, and pathless layouts prefixed `_`.
- Favor pure functions; avoid side effects beyond filesystem scanning in utilities.
- When extending detection logic ensure colocation errors remain descriptive (see `scanRouteModules` and `isColocatedFile`).
- Maintain TypeScript types in `src/core/types.ts` and keep `autoRoutes` API backwards compatible.
- The migration CLI now funnels orchestration through `runMigrationWorkflow`; dry-run support is exposed via `RunOptions` for tests/tooling.
- Use `buildImportRewritePlan` when you need to inspect import rewrites without performing disk writes (supports dry-run reporting).

## Behavior That Matters

- Index routes with matching segments: `home/index.tsx` nests under `home/_layout.tsx` when both resolve to `['home']`.
- `findParentRouteId()` handles that by checking the full segment path for index routes rather than `slice(0, -1)`.
- Index routes nested under non-root parents omit `path`; direct root-level index routes keep it, such as `dashboard/index.tsx` -> `path: "dashboard"`.

- Automatic folder-to-dot normalization: `api/users.ts` without `api.tsx` behaves like `api.users.ts` and becomes a root route with path `/api/users`.
- That normalization happens in `autoRoutes()` after route collection and only applies to simple folder nesting. It skips dot notation, special syntax, and index routes.
- When an explicit parent exists, such as `api.tsx` or `api/_layout.tsx`, normal nesting still applies.

## Tests And Docs

- Tests live in `test/` and rely on fixtures under `test/utils`.
- Add or update Vitest coverage when changing route parsing or detection behavior.
- Keep `README.md` examples aligned with any user-facing convention or option changes.
- Useful local checks: `pnpm typecheck`, `pnpm build`, `pnpm test`.

## Agent Notes

- When finishing a task that produced new edits, include a one-line commit message suggestion based on the full current uncommitted diff, not just the most recent change.
