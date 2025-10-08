# Refactoring Opportunities

## 1. Simplify the `createRoutePath` state machine
- **File**: `src/migration/create-routes-from-folders.ts:198`
- **Why it feels complex**: A 130+ line function mixes character-by-character parsing, state flags, and validation side effects. The TODO already notes the lack of structure and tests, and each new routing rule requires flag juggling.
- **Refactor direction**:
  - Extract a small tokenizer that emits semantic tokens (segment separator, escape start/end, optional start/end, parameter, literal).
  - Model parsing as a reducer over tokens (e.g., with a finite set of parser states) so optional segments, splats, and pathless layouts become explicit cases.
  - Reuse helpers already present in `src/core/routing/segments.ts` for shared behaviors (e.g., `PATHLESS_PREFIX`, segment sanitization) to avoid divergent logic between migration and core.
  - Cover the parser with dedicated Vitest cases using fixtures from `test/utils` to lock in current behavior before changing output.

## 2. Decompose the import rewrite pipeline
- **File**: `src/migration/import-rewriter.ts:64`
- **Why it feels complex**: `rewriteImports` orchestrates AST walking, path resolution, legacy `+` normalization, and suffix handling in one pass, while `getUpdatedImportSpecifier` coordinates three distinct strategies. This makes failures difficult to isolate.
- **Refactor direction**:
  - Split responsibilities into focused utilities: one for specifier tokenization/suffix handling, one for filesystem resolution, and one for legacy `+` rewrites.
  - Introduce an `ImportRewriteContext` object that carries shared data (`normalizedMapping`, source/target paths) to avoid threading parameters through every helper.
  - Consider using TypeScript's transformer API to emit rewritten nodes instead of manual string splicing; this removes the need for edit bookkeeping.
  - Expand tests around migration fixtures to assert rewritten specifiers for edge cases (directory indexes, hash/query suffixes, legacy colocated paths).

## 3. Separate parent resolution from name normalization
- **File**: `src/core/routing/structure.ts:18`
- **Why it feels complex**: `normalizeAndAssignParents` performs two passes that combine name normalization, parent lookup, and tree scaffolding. `findParentRouteId` blends scoring rules with lookup logic, which makes it hard to understand how index routes interact with layouts.
- **Refactor direction**:
  - Extract a `RouteNameNormalizer` that outputs stable names in isolation, feeding its result into a dedicated `ParentResolver`.
  - Replace the score integers in `getParentScore` with a descriptive enum or strategy map so adding a new priority reads declaratively.
  - Document invariants (e.g., index routes search with full segment path) and encode them as unit tests, especially for pathless layouts and automatic folder-to-dot normalization.
  - With clearer seams, `buildRouteTree` can consume a pre-computed `RouteHierarchy` structure instead of re-deriving parent/child relationships on every call.

## 4. Consolidate duplicated file-visiting helpers
- **Files**: `src/utils.ts:22`, `src/migration/fs-helpers.ts:6`
- **Why it feels complex**: Two nearly identical directory walkers evolve independently (one uses `fs.statSync`, the other `fs.lstatSync`). Divergence in symlink handling or dotfile visibility can introduce subtle bugs between core routing and migration paths.
- **Refactor direction**:
  - Move a single, well-tested `visitFiles` helper into a shared module (e.g., `src/fs/visitor.ts`) that both core and migration import.
  - Parameterize behaviors that differ today (stat method, symlink traversal, ignore dotfiles) via options instead of copy/paste.
  - Add regression tests that simulate symlinks and nested colocation folders to confirm the shared walker satisfies both call sites before deleting the duplicate.

