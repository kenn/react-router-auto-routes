# Agent Guidelines

## Project

- Library: `react-router-auto-routes` generates React Router v7 route configs from file-system structure.
- Core entry: `src/core/index.ts` exports `autoRoutes(options)`; default export is same.
- Legacy migration helpers live under `src/migration` for backwards compatibility with `remix-flat-routes`.
- Codebase is ESM-only; supported Node versions are declared in `package.json` `engines`.

## Important Modules

- `src/core/routing/files.ts`: file detection and route metadata collection; `segments.ts`: path building; `structure.ts`: tree assembly.
- `src/utils.ts`: shared helpers (`visitFiles`, `toPosixPath`, route id creation, `routesDir` normalization).
- `src/migration/route-scanner.ts` + `create-routes-from-folders.ts`: filesystem crawl and legacy route manifest for migrations.
- `src/migration/normalizers.ts`: legacy route ID and colocated path normalization.
- `src/migration/*`: migration workflow and CLI compatibility for older Remix setups.

## Route Conventions

- Route conventions: param char defaults to `$`, colocation prefix `+`, optional segments `(...)`, and pathless layouts prefixed `_`.
- Favor pure functions; avoid side effects beyond filesystem scanning in utilities.
- When extending detection logic ensure colocation errors remain descriptive (see `checkColocationViolations` in core and `isColocatedFile` in migration).
- Maintain TypeScript types in `src/core/types.ts` and keep `autoRoutes` API backwards compatible.
- The migration CLI now funnels orchestration through `runMigrationWorkflow`; dry-run support is exposed via `RunOptions` for tests/tooling.
- Use `buildImportRewritePlan` when you need to inspect import rewrites without performing disk writes (supports dry-run reporting).

## Behavior That Matters

- Index routes with matching segments: `home/index.tsx` nests under `home/_layout.tsx` when both resolve to `['home']`.
- `resolveParentId()` in `buildRouteTree()` handles that by checking the full segment path for index routes rather than `slice(0, -1)`.
- Index routes nested under non-root parents omit `path`; direct root-level index routes keep it, such as `dashboard/index.tsx` -> `path: "dashboard"`.

- Automatic folder-to-dot normalization: `api/users.ts` without `api.tsx` behaves like `api.users.ts` and becomes a root route with path `/api/users`.
- There is no separate normalization pass: only `_layout` files become parents in `buildRouteTree()`, so a folder route without a layout falls back to the root with its full path.
- Only a layout such as `api/_layout.tsx` makes `api/users.ts` a child; a sibling `api.tsx` stays a separate root route.

## Tests And Docs

- Tests live in `test/` and rely on fixtures under `test/utils`.
- Add or update Vitest coverage when changing route parsing or detection behavior.
- Keep `README.md` examples aligned with any user-facing convention or option changes.
- Useful local checks: `pnpm typecheck`, `pnpm build`, `pnpm test`.

## Agent Notes

- When finishing a task that produced new edits, include a one-line commit message suggestion based on the full current uncommitted diff, not just the most recent change.
