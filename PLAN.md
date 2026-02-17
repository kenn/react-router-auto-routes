# Layout Semantics Simplification Plan (Major Release)

## Summary

This plan removes confusing dual behavior and makes layout rules explicit:

- `_layout.tsx` (including dot-delimited forms like `dashboard._layout.tsx`) is the only layout file shape.
- `layout.tsx` is always a normal route file.

Additionally, root `_layout.tsx` will wrap the entire route tree (including pathless groups) so simple apps get intuitive top-level layout behavior.

## Motivation

Current behavior is difficult to explain and surprises users:

- `_layout.tsx` is pathless layout-only.
- `layout.tsx` creates a real URL segment (`/layout`) but is also treated as a parent candidate.

From user perspective, this is inconsistent and unintuitive. Most users expect one clear rule for layout files.

## Proposed Behavior (Breaking Change)

1. `_layout.tsx` (and `*._layout.tsx`) is the only explicit layout file (pathless layout route).
2. `layout.tsx` has no special behavior and is treated exactly like `about.tsx`.
3. Root `_layout.tsx` wraps all routes in that mount, including routes inside pathless groups like `_top/index.tsx`.
4. `route.tsx` semantics stay unchanged in this release; it is not a layout signal and keeps current path/ID behavior.
5. `_layout.route.tsx` (and `*._layout.route.tsx`) are treated as normal routes, not layout signals.

## Examples

### A) Root-level `_layout.tsx`

Input:

```txt
routes/
  _layout.tsx
  index.tsx
  about.tsx
```

Planned output shape:

- `_layout` at root (pathless)
- `index` nested under `_layout`
- `about` nested under `_layout`
- all other routes in the mount ultimately nested under `_layout`

### B) `layout.tsx` is normal route

Input:

```txt
routes/
  layout.tsx
  index.tsx
  about.tsx
```

Planned output shape:

- `layout.tsx` => `/layout` normal route
- `index.tsx` and `about.tsx` are unaffected by `layout.tsx`

### C) Non-root `layout.tsx`

Input:

```txt
routes/
  users/
    layout.tsx
    index.tsx
    edit.tsx
```

Planned output shape:

- `users/layout.tsx` => `/users/layout` normal route
- no automatic nesting under `users/layout.tsx`

### D) Root `_layout.tsx` with `route.tsx`

Input:

```txt
routes/
  _layout.tsx
  route.tsx
  about.tsx
```

Planned output shape:

- `route.tsx` remains a normal route file (same path semantics as today)
- root `_layout.tsx` is still the parent of `route.tsx` and `about.tsx`

## Migration Guidance

### 1) Projects using `layout.tsx` as layout today

Rename to `_layout.tsx` in the same folder.

Examples:

- `routes/layout.tsx` (used as layout) -> `routes/_layout.tsx`
- `routes/users/layout.tsx` (used as layout) -> `routes/users/_layout.tsx`

### 2) Projects using `layout.tsx` as real URL route

No rename required.

Examples:

- `routes/layout.tsx` should keep behaving as `/layout`
- `routes/users/layout.tsx` should keep behaving as `/users/layout`

### 3) Root `_layout.tsx` scope change

If root `_layout.tsx` previously wrapped only `/`, it will now wrap all routes in that mount. If that is not desired:

- move global shell concerns to `app/root.tsx`, or
- isolate wrapped routes into an explicit pathless group.

## Implementation Plan

1. Restrict layout detection in `src/core/routing/structure.ts`:
- treat only `_layout`/`._layout` as layout parents (`._layout` is intentional for dot-delimited files like `dashboard._layout.tsx`).
- remove `layout`/`.layout` parent-candidate behavior.
- remove `.route` aliasing from layout detection so `_layout.route.tsx` is not treated as a layout parent.

2. Keep root `_layout` parent lookup for the full mount:
- in `resolveParentId` (`src/core/routing/structure.ts`), keep the current prefix-search start (`segments.length - 1`) but change the loop condition from `length > 0` to `length >= 0` so empty-segment candidates are considered where the loop runs.
- add an explicit empty-segment fallback lookup for routes whose loop would not execute (notably zero-segment routes like root `route.tsx`) so root `_layout.tsx` still becomes parent.
- keep the existing `candidate.id !== route.id` guard so root `_layout.tsx` does not self-parent.
- preserve existing non-index same-segment behavior (do not introduce new same-segment parenting such as `foo.tsx` auto-nesting under `foo/_layout.tsx`).
- apply this consistently so all route branches in the same mount can nest under root `_layout` while preserving intermediate parent boundaries.

3. Remove `layout` from all special-file stripping paths (mandatory):
- update `src/core/routing/constants.ts` (`SPECIAL_ROUTE_FILES`) so `layout` is not stripped as a special name.
- keep `_layout` special behavior intact.
- ensure `src/core/routing/segments.ts` naming/path derivation no longer strips `layout` as a suffix segment.

4. Preserve deterministic sorting and existing non-layout sibling semantics.

5. Keep `route.tsx` behavior unchanged:
- no changes to `route`/`_route` stripping or detection logic in this release.
- only the new root `_layout` mount-wide parenting applies to `route.tsx` the same as any other route node.

6. Align detection/docs regex language with new semantics:
- remove `layout` from internal/default regex wording where it implies special behavior.
- update tests/docs that show `layout` as a special matcher token so `layout.tsx` is clearly ordinary.

## Test Plan

Add/adjust Vitest coverage (primarily in `test/routes-structure.test.ts`):

1. Root `_layout.tsx` wraps direct root siblings:
- `['_layout.tsx', 'index.tsx', 'about.tsx']` => both nested.

2. Root `_layout.tsx` wraps pathless-prefixed routes too:
- `['_layout.tsx', '_top/index.tsx']` => expected shape: root `_layout.tsx` is parent of `_top/index.tsx` directly (`_top` is naming/pathless prefix only, not a standalone route node).
- If `['_layout.tsx', '_top/_layout.tsx', '_top/index.tsx']`, then expected shape is root `_layout.tsx` -> `_top/_layout.tsx` -> `_top/index.tsx`.

3. `layout.tsx` is ordinary route at root:
- `['layout.tsx', 'index.tsx', 'about.tsx']` => `layout` route exists at `/layout`; no special parenting.

4. Dot-delimited `*.layout.tsx` is ordinary route too:
- `['dashboard.layout.tsx', 'dashboard.profile.tsx']` => `dashboard.layout` is a normal route node and does not become a parent candidate.

5. `users/layout.tsx` is ordinary route in nested folder:
- `['users/layout.tsx', 'users/index.tsx', 'users/edit.tsx']` => no auto-parenting by `users/layout.tsx`.

6. `_layout.route.tsx` is ordinary route too:
- `['_layout.route.tsx', 'index.tsx']` => `_layout.route` does not become a parent candidate.

7. `_layout.tsx` and `layout.tsx` can coexist in the same directory:
- `['dashboard/_layout.tsx', 'dashboard/layout.tsx', 'dashboard/index.tsx', 'dashboard/settings.tsx']` => `_layout` is the parent; `dashboard/layout.tsx` is a normal child route at `dashboard/layout` (relative `path: 'layout'`) and not a parent candidate.

8. `_layout` behavior remains intact for non-root:
- `['users/_layout.tsx', 'users/index.tsx', 'users/edit.tsx']` => expected nesting preserved.

9. Root `_layout.tsx` wraps nested folder routes:
- `['_layout.tsx', 'dashboard/index.tsx']` => expected shape: `dashboard/index.tsx` remains in normal folder hierarchy, with top branch nested under root `_layout.tsx`.

10. Root `_layout.tsx` also wraps `route.tsx` in the same mount:
- `['_layout.tsx', 'route.tsx', 'about.tsx']` => `route.tsx` keeps current path semantics but is nested under root `_layout.tsx`.

11. Preserve existing non-index same-segment behavior:
- `['foo/_layout.tsx', 'foo.tsx']` => `foo.tsx` remains a sibling (not auto-nested) unless existing rules already nest it.

12. Mount-aware isolation and parity (explicit):
- with `routesDir: { '/': 'routes', '/admin': 'admin/routes' }`, a root `_layout.tsx` in `/` must not parent routes from `/admin`.
- with `routesDir: { '/': 'routes', '/admin': 'admin/routes' }`, an `/admin` root `_layout.tsx` must parent only `/admin` routes.

## Documentation Updates

Update `README.md`:

- State clearly: only `_layout.tsx` defines layout nesting.
- Clarify: `layout.tsx` is a normal route file (no special nesting behavior).
- Clarify: `_layout.route.tsx` is not a layout signal.
- Add migration examples for `layout.tsx` -> `_layout.tsx` when users intended layout behavior.
- Document root `_layout.tsx` expanded wrapping scope for the full mounted route tree.

## Rollout

- Ship in next major version.
- Release notes section: "Layout semantics simplified".
- Include upgrade checklist and before/after examples.

## Risks and Tradeoffs

- Breaking for projects that relied on `layout.tsx` as a special parent.
- Reduced ambiguity and much clearer mental model for users.
- More predictable route trees and docs alignment.

## Success Criteria

- Users can explain layout behavior in one sentence: "Use `_layout.tsx` for layout; `layout.tsx` is just a route."
- Root `_layout.tsx` behavior matches expected app-shell usage for the full mounted route tree.
- No regressions in existing `_layout.tsx` nesting behavior outside root scope changes.
