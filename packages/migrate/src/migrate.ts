import * as path from 'path'
import autoRoutes from '../../../src/core/index'
import { ROUTE_EXTENSIONS } from '../../../src/core/routing/files'
import { getRouteSegments } from '../../../src/core/routing/segments'
import type { RouteConfig } from '../../../src/core/types'
import { visitFiles } from '../../../src/utils'
import {
  createRoutesFromFolders,
  type RouteManifest,
} from './create-routes-from-folders'
import { isColocatedFile, normalizeDirectoryPath } from './fs-helpers'
import {
  buildImportRewritePlan,
  executeImportRewritePlan,
  normalizeAbsolutePath,
  type FileMapping,
  type SpecifierReplacement,
} from './import-rewriter'
import { logInfo } from './logger'
import {
  convertColocatedPath,
  convertToRoute,
  escapeRouteSegment,
} from './normalizers'

export type MigrateOptions = {
  ignoredRouteFiles?: string[]
}

export function migrate(
  sourceDir: string,
  targetDir: string,
  options: MigrateOptions = {},
) {
  sourceDir = normalizeDirectoryPath(sourceDir)
  targetDir = normalizeDirectoryPath(targetDir)

  const ignoredPatterns = Array.from(
    new Set([...(options.ignoredRouteFiles ?? []), '**/.DS_Store']),
  )

  logInfo('🛠️ Migrating routes to + folder convention...')
  logInfo(`🗂️ source: ${sourceDir}`)
  logInfo(`🗂️ target: ${targetDir}`)
  logInfo(`🙈ignored files: ${ignoredPatterns}`)
  logInfo('')

  const routes = createRoutesFromFolders({
    appDirectory: './',
    routesDirectory: sourceDir,
    ignoredFilePatterns: ignoredPatterns,
  })

  const routeMappings = collectRouteMappings(routes, sourceDir, targetDir)
  const routeSourcePaths = new Set(
    routeMappings.map((m) => normalizeAbsolutePath(m.source)),
  )
  const colocatedMappings = collectColocatedMappings(
    sourceDir,
    targetDir,
    routeSourcePaths,
  )
  const mappings = [...routeMappings, ...colocatedMappings]
  const normalizedMapping = createNormalizedMapping(mappings)
  const specifierReplacements = createSpecifierReplacements(
    mappings,
    sourceDir,
    targetDir,
  )

  // Validate and prepare every source before writing anything. This prevents a
  // parse failure in a later file from leaving a partially generated target.
  const plans = mappings.map((mapping) =>
    buildImportRewritePlan(mapping, normalizedMapping, specifierReplacements),
  )

  for (const plan of plans) {
    executeImportRewritePlan(plan)
  }

  logInfo('🏁 Finished!')
}

function collectRouteMappings(
  routes: RouteManifest,
  sourceDir: string,
  targetDir: string,
): FileMapping[] {
  const parentIds = new Set(
    Object.values(routes).map((route) => route.parentId),
  )

  const targets = new Map<string, RouteTarget>()
  for (const [id, { file }] of Object.entries(routes)) {
    const extension = path.extname(file)
    if (ROUTE_EXTENSIONS.includes(extension)) {
      targets.set(id, {
        name: convertToRoute(sourceDir, id, parentIds.has(id)),
        extension,
      })
    }
  }

  const names = preserveLegacyParents(routes, targets, parentIds)

  return Array.from(targets, ([id, { extension }]) => ({
    source: path.resolve(routes[id].file),
    target: path.resolve(targetDir, `${names.get(id)}${extension}`),
  }))
}

type RouteTarget = { name: string; extension: string }

/**
 * In the legacy folder convention a `.` never nests, but `autoRoutes` nests a
 * route under any `_layout` whose segments prefix its own. A dot-named
 * sibling such as `settings/profile.two-factor` would therefore move under the
 * promoted `settings/profile/_layout` (promoted from a legacy route with
 * children). This runs `autoRoutes` on the planned
 * names and, wherever a route lands under a deeper layout than its legacy
 * parent, escapes the matching segment (`profile_.two-factor`), which keeps
 * the URL but breaks the match. Escapes also apply to the route's legacy
 * descendants so they keep nesting under it. Returns names keyed by legacy id.
 */
function preserveLegacyParents(
  routes: RouteManifest,
  targets: Map<string, RouteTarget>,
  promotedLayouts: Set<string>,
): Map<string, string> {
  const escapes = new Map<string, Set<number>>()

  const nameOf = (id: string): string => {
    let name = targets.get(id)!.name
    for (
      let current = id;
      routes[current];
      current = routes[current].parentId
    ) {
      for (const segmentIndex of escapes.get(current) ?? []) {
        name = escapeRouteSegment(name, segmentIndex) ?? name
      }
    }
    return name
  }

  // Each pass adds at least one escape; bound the loop defensively anyway.
  for (let pass = 0; pass <= targets.size; pass++) {
    const names = new Map(Array.from(targets.keys(), (id) => [id, nameOf(id)]))
    const legacyIdByRouteId = new Map(
      Array.from(names, ([id, name]) => [`routes/${name}`, id]),
    )

    let tree: RouteConfig[]
    try {
      tree = autoRoutes({
        visitFiles: (_dir, visit) => {
          for (const [id, name] of names) {
            visit(`${name}${targets.get(id)!.extension}`)
          }
        },
      })
    } catch {
      // Conflicts are reported when the CLI verifies the migrated routes.
      return names
    }

    let changed = false
    const visit = (configs: RouteConfig[], parentId: string) => {
      for (const config of configs) {
        const id = legacyIdByRouteId.get(config.id)
        const actualParent =
          parentId === ROOT_ID ? ROOT_ID : legacyIdByRouteId.get(parentId)
        if (id && actualParent && actualParent !== routes[id].parentId) {
          changed = escapeFrom(id, actualParent) || changed
        }
        visit(config.children ?? [], config.id)
      }
    }

    // `id` landed under the layout `stealer`; escape the segment that
    // matches the stealer's last segment so the prefix no longer matches.
    const escapeFrom = (id: string, stealer: string): boolean => {
      // Only layouts this migration promoted change nesting; legacy
      // `_layout` files already nest their folder in `autoRoutes`.
      if (stealer === ROOT_ID || !promotedLayouts.has(stealer)) return false
      const expected = routes[id].parentId
      const depth = segmentCount(names.get(stealer)!)
      if (expected !== ROOT_ID && segmentCount(names.get(expected)!) >= depth) {
        return false
      }

      const segmentIndex = depth - 1
      const own = escapes.get(id) ?? new Set<number>()
      if (
        own.has(segmentIndex) ||
        !escapeRouteSegment(names.get(id)!, segmentIndex)
      ) {
        return false
      }
      own.add(segmentIndex)
      escapes.set(id, own)
      return true
    }

    visit(tree, ROOT_ID)
    if (!changed) {
      return names
    }
  }

  return new Map(Array.from(targets.keys(), (id) => [id, nameOf(id)]))
}

const ROOT_ID = 'root'

function segmentCount(name: string): number {
  return getRouteSegments(name, false).segments.length
}

function collectColocatedMappings(
  sourceDir: string,
  targetDir: string,
  routeSourcePaths: Set<string>,
): FileMapping[] {
  const mappings: FileMapping[] = []

  visitFiles(
    sourceDir,
    (file) => {
      if (!isColocatedFile(file)) {
        return
      }

      const sourcePath = path.resolve(sourceDir, file)
      if (routeSourcePaths.has(normalizeAbsolutePath(sourcePath))) {
        return
      }

      const targetPath = path.resolve(targetDir, convertColocatedPath(file))
      mappings.push({ source: sourcePath, target: targetPath })
    },
    { followSymlinks: false },
  )

  return mappings
}

function createNormalizedMapping(mappings: FileMapping[]): Map<string, string> {
  const normalized = new Map<string, string>()
  for (const mapping of mappings) {
    normalized.set(
      normalizeAbsolutePath(mapping.source),
      normalizeAbsolutePath(mapping.target),
    )
  }
  return normalized
}

function createSpecifierReplacements(
  mappings: FileMapping[],
  sourceDir: string,
  targetDir: string,
): SpecifierReplacement[] {
  if (mappings.length === 0) {
    return []
  }

  const replacements: SpecifierReplacement[] = []
  const seen = new Set<string>()
  const sourceDirAbsolute = normalizeAbsolutePath(path.resolve(sourceDir))
  const targetDirAbsolute = normalizeAbsolutePath(path.resolve(targetDir))
  const sourceDirImport = normalizeImportPath(sourceDir)
  const prefixes = createPrefixCandidates(sourceDirImport)

  for (const mapping of mappings) {
    const sourceAbsolute = normalizeAbsolutePath(mapping.source)
    const targetAbsolute = normalizeAbsolutePath(mapping.target)

    const sourceRelative = normalizeImportPath(
      path.relative(sourceDirAbsolute, sourceAbsolute),
    )
    if (sourceRelative.startsWith('../')) {
      continue
    }

    const targetRelative = normalizeImportPath(
      path.relative(targetDirAbsolute, targetAbsolute),
    )
    if (targetRelative.startsWith('../')) {
      continue
    }

    for (const prefix of prefixes) {
      const from = prefix ? `${prefix}/${sourceRelative}` : sourceRelative
      const to = prefix ? `${prefix}/${targetRelative}` : targetRelative
      if (from === to) {
        continue
      }
      const key = `${from}->${to}`
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      replacements.push({ from, to })
    }
  }

  replacements.sort((a, b) => b.from.length - a.from.length)
  return replacements
}

function normalizeImportPath(value: string): string {
  let normalized = value.replace(/\\/g, '/')
  if (normalized.startsWith('./')) {
    normalized = normalized.slice(2)
  }
  normalized = normalized.replace(/\/+/g, '/')
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }
  return normalized
}

function createPrefixCandidates(base: string): string[] {
  const prefixes = new Set<string>()
  if (base) {
    prefixes.add(base)
    const segments = base.split('/')
    for (let index = 1; index < segments.length; index += 1) {
      const suffix = segments.slice(index).join('/')
      if (suffix) {
        prefixes.add(suffix)
      }
    }
  }
  prefixes.add('')

  return Array.from(prefixes)
}
