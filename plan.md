# Plan: routesDir overhaul

## Goals

- Collapse `rootDir`/`routesDir` handling into a single, flexible `routesDir` option.
- Support mappings from URL mount paths to filesystem directories.
- Favor explicit configuration over legacy shims.
- Document realistic multi-app setups (main site + tools) and ensure tests cover new shapes.

## Option Resolution

1. Update `ResolvedOptions` to carry an array of normalized route roots:
   ```ts
   type NormalizedRoutesDir = {
     mountPath: string // e.g. '/', '/tools/app1'
     fsDir: string // absolute path to scan
     idPrefix: string // e.g. 'routes', 'tools/keyword-analyzer/routes'
   }
   ```
2. Accept `routesDir` in three shapes:
   - `string`: treated as `{ '/': value }`.
   - `string[]`: each element maps to `{ '/': value }`.
   - `Record<string, string>`: key is mount path, value is relative dir.
3. Validation rules:
   - Mount paths must start with `/`, no trailing `/` except root, and cannot repeat.
   - Directory values must be relative (no absolute, no `..`, no leading `./`).
   - Normalize by resolving against `process.cwd()` (or config file directory when available).
4. Each normalized entry stores:
   - `fsDir`: resolve relative to the config file / cwd.
   - `idPrefix`: always the original relative dir (e.g. `'routes'`, `'tools/keyword-analyzer/routes'`) so manifest IDs mirror the caller input.
   - `mountPath`: taken directly from the normalized mapping.

## Routing Internals

1. Modify `collectRouteInfos` to iterate over `NormalizedRoutesDir` entries:
   - Use `fsDir` for visiting files (replaces `rootDir + routeDir`).
   - Prefix route IDs with `idPrefix` so existing manifests stay stable.
   - Store `mountPath` on `RouteInfo` for later path computation.
   - Store `sourceKey` (e.g. `${mountPath}::${idPrefix}`) so grouping logic can isolate routes from different mounts.
2. Extend `RouteInfo` with `mountPath` and `sourceKey` metadata.
3. When generating `route.path`, prepend `mountPath` (unless it's `'/'`).
4. Update parent lookup/normalization to constrain candidates to the same `sourceKey`; this prevents cross-mount nesting while keeping dot-flattening within a mount.

## Documentation

- Replace section with realistic example:
  ```ts
  autoRoutes({
    routesDir: {
      '/': 'app/routes',
      '/tools/keyword-analyzer': 'tools/keyword-analyzer/routes',
      '/tools/meta-preview': 'tools/meta-preview/routes',
    },
  })
  ```
- Example tree should show `tools/keyword-analyzer/routes/...` without redundant nested folders.
- Call out how the primary app typically maps `'/': 'app/routes'`, while additional mounts unlock cleaner folder structures without redundant folders.
- Note that dot notation remains supported but is optional.
- Include a callout describing the multi-app layout (shared libs under `app/`, standalone tool stacks like `tools/keyword-analyzer/{components,managers,routes}`) and emphasize that IDs stay scoped to the supplied prefix (e.g. `tools/keyword-analyzer/routes/index.tsx` → `id: 'tools/keyword-analyzer/routes/index'`).
- Highlight the recommended explicit mapping for the primary app (`'/': 'app/routes'`) so teams avoid implicit assumptions about project layout.

## Tests

- Update `options-and-detection` to cover:
  - Object form with multiple mounts; verify generated paths include `/tools/...`.
  - Validation errors for bad mount keys (`'tools'`, duplicate `/`, trailing slashes).
  - Mixed array + string usage.
- Refresh expectations in `filesystem-behavior.test.ts` and `routes-structure.test.ts` to account for `mountPath`-prefixed paths and new path resolution rules.

## Compatibility & Cleanup

- Remove `rootDir` from the public options, migrate internal consumers to the new normalization helper, and adjust migration helpers if necessary.
- Update release notes / README to highlight mount mappings, explicit defaults, and the new resolution behavior.
- Re-run `pnpm test` and `pnpm typecheck`.
