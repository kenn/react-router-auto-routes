# Agent Guidelines

## Project

- Library: `react-router-auto-routes` generates React Router v7 route configs from file-system structure.
- Core entry: `src/core/index.ts` exports `autoRoutes(options)`; default export is same.
- Legacy migration helpers live under `packages/migrate` (pnpm workspace package `react-router-auto-routes-migrate`, private until published) for backwards compatibility with `remix-flat-routes`.
- The library is published as ESM and the migration CLI as CommonJS. Supported Node versions are declared in `package.json` `engines`.

## Important Modules

- `src/core/routing/files.ts`: file detection and route metadata collection; `segments.ts`: path building; `structure.ts`: tree assembly.
- `src/utils.ts`: shared helpers (`visitFiles`, `toPosixPath`, route id creation, `routesDir` normalization).
- `packages/migrate/src/route-scanner.ts` + `create-routes-from-folders.ts`: filesystem crawl and legacy route manifest for migrations.
- `packages/migrate/src/normalizers.ts`: legacy route ID and colocated path normalization.
- `packages/migrate/src/*`: migration workflow and CLI compatibility for older Remix setups. It imports core internals by relative path (`../../../src/...`); the root `tsup` config bundles it into `dist/cli.cjs`.

## Route Conventions

- Route conventions: param char defaults to `$`, colocation prefix `+`, optional segments `(...)`, and pathless layouts prefixed `_`.
- Favor pure functions; avoid side effects beyond filesystem scanning in utilities.
- When extending detection logic ensure colocation errors remain descriptive (see `checkColocationViolations` in core and `isColocatedFile` in migration).
- Maintain TypeScript types in `src/core/types.ts` and keep `autoRoutes` API backwards compatible.
- The migration CLI uses `runMigrationWorkflow`. For tests and tooling, `RunOptions.dryRun` generates the target tree (replacing an existing target directory) and stops before swapping it into place.
- Use `buildImportRewritePlan` when you need to inspect import rewrites without performing disk writes (supports dry-run reporting).

## Behavior That Matters

- Index routes with matching segments: `home/index.tsx` nests under `home/_layout.tsx` when both resolve to `['home']`.
- `resolveParentId()` in `buildRouteTree()` handles that by checking the full segment path for index routes rather than `slice(0, -1)`.
- Index routes omit `path` when no relative URL segments remain. Under `dashboard/_layout.tsx`, `dashboard/index.tsx` omits `path`, while `dashboard/projects/$id/index.tsx` keeps `path: "projects/:id"` if there is no closer layout.

- With no ancestor layout, `api/users.ts` and `api.users.ts` both produce a root route with `path: "api/users"` (URL `/api/users`).
- There is no separate normalization pass: only `_layout` files become parents in `buildRouteTree()`, so a folder route without a layout falls back to the root with its full path.
- `api/_layout.tsx` can parent `api/users.ts`. A sibling `api.tsx` cannot parent it; both are root routes if there is no ancestor layout.

## Tests And Docs

- Core tests live in `test/`, migration tests in `packages/migrate/test/`; both rely on helpers under `test/utils` and run together as Vitest projects via `pnpm test`.
- Add or update Vitest coverage when changing route parsing or detection behavior.
- Keep `README.md` examples aligned with any user-facing convention or option changes.
- Useful local checks: `pnpm typecheck`, `pnpm build`, `pnpm test`.

## Agent Notes

- When finishing a task that produced new edits, include a one-line commit message suggestion based on the full current uncommitted diff, not just the most recent change.
