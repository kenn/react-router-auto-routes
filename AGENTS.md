# Agent Guidelines

## Project Snapshot

- Library: `react-router-auto-routes` generates React Router v7 route configs from file-system structure.
- Core entry: `src/core/index.ts` exports `autoRoutes(options)`; default export is same.
- Legacy migration helpers live under `src/migration` for backwards compatibility with Remix flat routes.

## Key Modules

- `src/core/route-detection.ts`: validates route files, enforces `+` colocation prefix rules, and normalizes custom regex.
- `src/core/route-info.ts`: turns filesystem entries into `RouteInfo` structures and resolves parent/child relationships.
- `src/core/route-path.ts`: builds URL paths, supporting params (`$`), optionals `(...)`, splats, and pathless layouts (`_`).
- `src/utils.ts`: shared helpers (`defaultVisitFiles`, memoized regex, route id normalization).
- `src/migration/*`: CLI compatibility for older Remix setups via `createRoutesFromFolders`.

## Tooling & Commands

- TypeScript project (`tsconfig.json`), bundled with `tsup`.
- Primary scripts (package.json): `pnpm build` → tsup, `pnpm test` → Vitest, `pnpm typecheck` → tsc project build.
- Tests live in `test/`; rely on fixture directories under `test/utils`.

## Implementation Notes

- Codebase is ESM-only; import via `import` syntax, use Node 22+.
- Route conventions: param char defaults to `$`, colocation prefix `+`, optional segments `(...)`, and pathless layouts prefixed `_`.
- When extending detection logic ensure colocation errors remain descriptive (see `isRouteModuleFile`).
- Maintain TypeScript types in `src/core/types.ts` and keep `autoRoutes` API backwards compatible.

### Route Nesting Behavior

- **Index routes with matching segments**: `home/index.tsx` automatically nests under `home/_layout.tsx` when both have segments `['home']`
  - Implemented in `findParentRouteId()` - index routes look for parents using full segment path, not `slice(0, -1)`
  - Index routes nested under non-root parents omit the `path` property (React Router handles them automatically)
  - Direct root-level index routes keep their path (e.g., `dashboard/index.tsx` → `path: "dashboard"`)

- **Automatic synthetic parent routes**: Nested folder routes like `api/users.ts` automatically get parent routes created
  - Implemented in `autoRoutes()` after route collection, before parent resolution
  - Synthetic parents have no `file` property in the RouteConfig output
  - Only created for simple folder nesting (skips dot notation, special syntax, index routes)
  - Detection logic checks file path segments for dots, parentheses, or other special characters
  - If explicit parent exists (e.g., `api.tsx` or `api/_layout.tsx`), synthetic parent is not created
  - Allows API routes and other nested structures to work without requiring layout files

## Contribution Checklist

- Favor pure functions; avoid side effects beyond filesystem scanning in utilities.
- Update or add Vitest coverage when changing route parsing/detection.
- Run `pnpm typecheck` and `pnpm test` before committing.
- Keep README examples aligned with any new conventions or options.
- When finished, generate a one liner commit message summarizing changes.

## References

- README.md: end-user documentation & conventions overview.
- `test/`: behavior expectations for routing edge cases.
