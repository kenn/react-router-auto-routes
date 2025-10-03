# Plan: routesDir overhaul

## Goals

- Collapse `rootDir`/`routesDir` into a single, flexible `routesDir` option.
- Support mappings from URL mount paths to filesystem directories.
- Preserve backwards compatibility for simple string/array usage.
- Document realistic multi-app setups (main site + tools) and ensure tests cover new shapes.

## Option Resolution

1. Update `ResolvedOptions` to carry an array of normalized route roots:
   ```ts
   type NormalizedRoutesDir = {
     mountPath: string // e.g. '/', '/tools/app1'
     fsDir: string // absolute path to scan
     idPrefix: string // e.g. 'app/routes', 'app1/routes'
   }
   ```
2. Accept `routesDir` in three shapes:
   - `string`: treated as `{ '/': value }`.
   - `string[]`: each element is `{ '/': value }`.
   - `Record<string, string>`: key is mount path, value is relative dir.
3. Validation rules:
   - Mount paths must start with `/`, no trailing `/` except root.
   - Directory values must be relative (no absolute, no `..`, no leading `./`).
   - Normalize by resolving against `process.cwd()` (or config location if provided).
4. Default becomes `routesDir: 'app/routes'`.

## Routing Internals

1. Modify `collectRouteInfos` to iterate over `NormalizedRoutesDir` entries:
   - Use `fsDir` for visiting files.
   - Prefix route IDs with `idPrefix` (original relative dir).
   - Store `mountPath` on `RouteInfo` for later path computation.
2. Adjust `RouteInfo` to include `mountPath` and `fsRoot` metadata.
3. When generating `route.path`, prepend `mountPath` (unless it's `'/'`).
4. Update parent lookup/normalization to stay within the same `fsRoot` + `mountPath` grouping.

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
- Emphasize that folder repetition is no longer required when using mapped mounts.
- Note that dot notation remains supported but is optional.

## Tests

- Update `options-and-detection` to cover:
  - Object form with multiple mounts; verify generated paths include `/tools/...`.
  - Validation errors for bad mount keys (`'tools'`, `'/'` duplicates).
  - Mixed array + string usage.
- Ensure existing tests referencing `routesDir` strings still pass (backward compatibility).

## Compatibility & Cleanup

- Remove `rootDir` default/usage and adjust migration helpers if necessary.
- Update release notes / README breaking change section.
- Re-run `pnpm test` and `pnpm typecheck`.
