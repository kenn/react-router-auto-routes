import * as path from 'path'
import { MIGRATION_ROUTE_EXTENSIONS } from './constants'
import { createRoutesFromFolders } from './create-routes-from-folders'
import {
  isColocatedFile,
  normalizeDirectoryPath,
  visitFiles,
} from './fs-helpers'
import {
  buildImportRewritePlan,
  executeImportRewritePlan,
  normalizeAbsolutePath,
  type FileMapping,
  type SpecifierReplacement,
} from './import-rewriter'
import { logInfo } from './logger'
import { convertColocatedPath, convertToRoute } from './normalizers'
import { defineRoutes, type RouteManifest } from './route-definition'

export { convertToRoute } from './normalizers'

export type MigrateOptions = {
  force: boolean
  ignoredRouteFiles?: string[]
}

export function migrate(
  sourceDir: string,
  targetDir: string,
  options: MigrateOptions = {
    force: false,
    ignoredRouteFiles: undefined,
  },
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

  const routes = createRoutesFromFolders(defineRoutes, {
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
  const mappings: FileMapping[] = []

  for (const [id, route] of Object.entries(routes)) {
    const { path: routePath, file, parentId } = route
    const extension = path.extname(file)
    if (!MIGRATION_ROUTE_EXTENSIONS.includes(extension)) {
      continue
    }

    const flat = convertToRoute(routes, sourceDir, id, parentId!)

    const sourcePath = path.resolve(file)
    const targetPath = path.resolve(targetDir, `${flat}${extension}`)
    mappings.push({ source: sourcePath, target: targetPath })
  }

  return mappings
}

function collectColocatedMappings(
  sourceDir: string,
  targetDir: string,
  routeSourcePaths: Set<string>,
): FileMapping[] {
  const mappings: FileMapping[] = []

  visitFiles(sourceDir, (file) => {
    if (!isColocatedFile(file)) {
      return
    }

    const sourcePath = path.resolve(sourceDir, file)
    if (routeSourcePaths.has(normalizeAbsolutePath(sourcePath))) {
      return
    }

    const targetPath = path.resolve(targetDir, convertColocatedPath(file))
    mappings.push({ source: sourcePath, target: targetPath })
  })

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
