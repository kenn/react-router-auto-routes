import * as path from 'path'

import { NormalizedRoutesDir, RoutesDirInput } from './core/types'
import { visitFiles as walkFiles } from './fs/visit-files'

export function defaultVisitFiles(
  dir: string,
  visitor: (file: string) => void,
) {
  walkFiles(dir, visitor)
}

export function createRouteId(file: string): string {
  const normalized = file.split(path.win32.sep).join('/')
  return normalized.replace(/\.[a-z0-9]+$/i, '')
}

export function normalizeRoutesDir(routeDir: string) {
  const trimmed = routeDir.trim()

  if (!trimmed) {
    throw new Error(
      `routesDir entries must be non-empty strings. Got: '${routeDir}'`,
    )
  }

  let normalized = trimmed.replace(/\\/g, '/')
  normalized = normalized.replace(/\/+/g, '/')

  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }

  if (!normalized) {
    throw new Error(
      `routesDir entries must resolve to a folder. Got: '${routeDir}'`,
    )
  }

  if (normalized.startsWith('/')) {
    throw new Error(
      `routesDir entries must be relative paths, not absolute. Got: '${routeDir}'`,
    )
  }

  const segments = normalized.split('/')
  if (segments.some((segment) => segment === '' || segment === '.')) {
    throw new Error(
      `routesDir entries cannot contain '.' segments. Got: '${routeDir}'`,
    )
  }

  return normalized
}

function normalizeMountPath(mountPath: string): string {
  if (!mountPath.trim()) {
    throw new Error('routesDir mount paths must be non-empty strings.')
  }

  const normalized = mountPath.trim()

  if (!normalized.startsWith('/')) {
    throw new Error(
      `routesDir mount paths must start with '/'. Got: '${mountPath}'`,
    )
  }

  if (normalized !== '/' && normalized.endsWith('/')) {
    throw new Error(
      `routesDir mount paths cannot end with '/'. Got: '${mountPath}'`,
    )
  }

  return normalized
}

type RoutesDirEntry = {
  mountPath: string
  dir: string
}

function toRoutesDirEntries(
  routesDir: RoutesDirInput | undefined,
): RoutesDirEntry[] {
  if (routesDir === undefined) {
    return [{ mountPath: '/', dir: 'routes' }]
  }

  if (typeof routesDir === 'string') {
    return [{ mountPath: '/', dir: routesDir }]
  }

  const entries: RoutesDirEntry[] = []
  for (const [mountPath, dir] of Object.entries(routesDir)) {
    entries.push({ mountPath, dir })
  }

  if (entries.length === 0) {
    throw new Error('routesDir object must contain at least one entry.')
  }

  return entries
}

// inspired by @react-router/dev/routes
function getRootDirectory(): string {
  return process.cwd()
}

// inspired by @react-router/dev/routes
function getAppDirectory(): string {
  return (
    (globalThis as any).__reactRouterAppDirectory ??
    path.resolve(getRootDirectory(), 'app')
  )
}

function resolveBaseDirFor(routesDir: RoutesDirInput | undefined): string {
  return routesDir === undefined || typeof routesDir === 'string'
    ? getAppDirectory()
    : getRootDirectory()
}

export function normalizeRoutesDirOption(
  routesDir: RoutesDirInput | undefined,
): NormalizedRoutesDir[] {
  const resolvedBase = resolveBaseDirFor(routesDir)
  const seenMountPaths = new Set<string>()

  const entries = toRoutesDirEntries(routesDir).map(({ mountPath, dir }) => {
    const normalizedMount = normalizeMountPath(mountPath)
    if (seenMountPaths.has(normalizedMount)) {
      throw new Error(
        `Duplicate routesDir mount path detected: '${normalizedMount}'.`,
      )
    }
    seenMountPaths.add(normalizedMount)

    const normalizedDir = normalizeRoutesDir(dir)
    const fsDir = path.resolve(resolvedBase, normalizedDir)

    const idPrefix =
      normalizedMount === '/' && normalizedDir === 'app/routes'
        ? 'routes'
        : normalizedDir

    return {
      mountPath: normalizedMount,
      fsDir,
      idPrefix,
      importPrefix: normalizedDir,
    }
  })

  const rootEntry = entries.find((entry) => entry.mountPath === '/')
  const appDir = rootEntry ? path.dirname(rootEntry.fsDir) : getAppDirectory()

  return entries.map((entry) => {
    const relativeImport = path.relative(appDir, entry.fsDir) || '.'
    const normalizedImport = relativeImport.split(path.sep).join('/')

    return {
      ...entry,
      importPrefix: normalizedImport === '.' ? '' : normalizedImport,
    }
  })
}
