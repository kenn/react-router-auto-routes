# Agent Guidelines

## Project Snapshot

- Library: `react-router-auto-routes` generates React Router v7 route configs from file-system structure.
- Core entry: `src/core/index.ts` exports `autoRoutes(options)`; default export is same.
- Legacy migration helpers live under `src/migration` for backwards compatibility with `remix-flat-routes`.

## Key Modules

- `src/core/routing/*`: detection, metadata collection, path building, normalization, and tree assembly.
- `src/utils.ts`: shared helpers (`defaultVisitFiles`, memoized regex, route id normalization).
- `src/migration/route-scanner.ts`: filesystem crawl + ignore handling for legacy migrations.
- `src/migration/normalizers.ts`: legacy route ID and colocated path normalization.
- `src/migration/*`: CLI compatibility for older Remix setups via `createRoutesFromFolders`.

## Tooling & Commands

- TypeScript project (`tsconfig.json`), bundled with `tsup`.
- Primary scripts (package.json): `pnpm build` → tsup, `pnpm test` → Vitest, `pnpm typecheck` → tsc project build.
- Tests live in `test/`; rely on fixture directories under `test/utils`.

## Implementation Notes

- Codebase is ESM-only; import via `import` syntax, use Node 22+.
- Route conventions: param char defaults to `$`, colocation prefix `+`, optional segments `(...)`, and pathless layouts prefixed `_`.
- When extending detection logic ensure colocation errors remain descriptive (see `scanRouteModules` and `isColocatedFile`).
- Maintain TypeScript types in `src/core/types.ts` and keep `autoRoutes` API backwards compatible.
- The migration CLI now funnels orchestration through `runMigrationWorkflow`; dry-run support is exposed via `RunOptions` for tests/tooling.
- Use `buildImportRewritePlan` when you need to inspect import rewrites without performing disk writes (supports dry-run reporting).

### Route Nesting Behavior

- **Index routes with matching segments**: `home/index.tsx` automatically nests under `home/_layout.tsx` when both have segments `['home']`
  - Implemented in `findParentRouteId()` - index routes look for parents using full segment path, not `slice(0, -1)`
  - Index routes nested under non-root parents omit the `path` property (React Router handles them automatically)
  - Direct root-level index routes keep their path (e.g., `dashboard/index.tsx` → `path: "dashboard"`)

- **Automatic folder-to-dot normalization**: Nested folder routes without parents are flattened to root level
  - `api/users.ts` without `api.tsx` behaves like `api.users.ts` (creates route at root with path `/api/users`)
  - Implemented in `autoRoutes()` after route collection - checks for missing parents and updates route names
  - Only applies to simple folder nesting (skips dot notation, special syntax like parentheses, index routes)
  - When explicit parent exists (`api.tsx` or `api/_layout.tsx`), normal nesting occurs
  - Solves React Router v7's requirement for physical files while maintaining folder organization convenience

## Contribution Checklist

- Favor pure functions; avoid side effects beyond filesystem scanning in utilities.
- Update or add Vitest coverage when changing route parsing/detection.
- Rely on `prepublishOnly` (typecheck → build → test --run) for release safety, but run any of those commands locally when working on routing internals.
- Keep README examples aligned with any new conventions or options.
- When finished, generate a one liner commit message summarizing changes.

## Release Process

1. Bump version in `package.json` (follow semver)
2. Run `pnpm run release:patch` or `pnpm run release:minor` to handle versioning, publishing, and then pushing (publish runs before `git push`/`git push --tags` and triggers `prepublishOnly` for typecheck/build/test --run).

## References

- README.md: end-user documentation & conventions overview.
- `test/`: behavior expectations for routing edge cases.
