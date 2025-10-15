import * as fs from 'fs'
import * as path from 'path'
import { createRoutesFromFolders } from './create-routes-from-folders'
import {
  isColocatedFile,
  normalizeDirectoryPath,
  visitFiles,
} from './fs-helpers'
import {
  normalizeAbsolutePath,
  rewriteAndCopy,
  type FileMapping,
  type SpecifierReplacement,
} from './import-rewriter'
import { defineRoutes, type RouteManifest } from './route-definition'

export type MigrateOptions = {
  force: boolean
  ignoredRouteFiles?: string[]
}

const routeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.md', '.mdx']

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

  console.log('🛠️ Migrating routes to + folder convention...')
  console.log(`🗂️ source: ${sourceDir}`)
  console.log(`🗂️ target: ${targetDir}`)
  console.log(`🙈ignored files: ${ignoredPatterns}`)
  console.log()

  const routes = createRoutesFromFolders(defineRoutes, {
    appDirectory: './',
    routesDirectory: sourceDir,
    ignoredFilePatterns: ignoredPatterns,
  })

  const routeMappings = collectRouteMappings(routes, sourceDir, targetDir)
  const colocatedMappings = collectColocatedMappings(sourceDir, targetDir)
  const normalizedMapping = createNormalizedMapping([
    ...routeMappings,
    ...colocatedMappings,
  ])
  const specifierReplacements = createSpecifierReplacements(
    [...routeMappings, ...colocatedMappings],
    sourceDir,
    targetDir,
  )

  for (const mapping of routeMappings) {
    rewriteAndCopy(mapping, normalizedMapping, specifierReplacements)
  }

  for (const mapping of colocatedMappings) {
    rewriteAndCopy(mapping, normalizedMapping, specifierReplacements)
  }

  console.log('🏁 Finished!')
}

export function convertToRoute(
  routes: RouteManifest,
  sourceDir: string,
  id: string,
  parentId: string,
) {
  // strip sourceDir from id and parentId
  let routeId = id.substring(sourceDir.length + 1)
  parentId =
    parentId === 'root' ? parentId : parentId.substring(sourceDir.length + 1)

  let flat = routeId
    // remove + suffix from folder names (old convention marker)
    .replace(/\+\//g, '/')
    // convert double __ to single _ for pathless layout prefix
    .replace(/(^|\/|\.)__/g, '$1_')

  // check if route is a parent route
  // if so, move to folder as _layout route
  if (Object.values(routes).some((r) => r.parentId === id)) {
    flat = flat + '/_layout'
  }

  return flat
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
    if (!routeExtensions.includes(extension)) {
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
): FileMapping[] {
  const mappings: FileMapping[] = []

  visitFiles(sourceDir, (file) => {
    if (!isColocatedFile(file)) {
      return
    }

    const sourcePath = path.resolve(sourceDir, file)
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

function convertColocatedPath(file: string): string {
  const normalized = file.replace(/\\/g, '/')
  const segments = normalized.split('/')

  // Find the first colocated folder (without + suffix)
  let colocatedFolderIndex = -1
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i]
    if (
      segment &&
      !segment.endsWith('+') &&
      segment !== '.' &&
      segment !== ''
    ) {
      colocatedFolderIndex = i
      break
    }
  }

  // Process each segment
  const converted = segments.map((segment, index) => {
    const isLastSegment = index === segments.length - 1

    // Add + prefix to the first colocated folder
    if (index === colocatedFolderIndex) {
      return '+' + segment
    }

    // Remove + suffix from route folders
    if (!isLastSegment) {
      return segment.replace(/\+$/, '')
    }

    // Keep filename as-is
    return segment
  })

  return converted.join(path.sep)
}
