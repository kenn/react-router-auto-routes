import fs from 'node:fs'
import * as path from 'node:path'
import { NormalizedRoutesDir, RoutesDirInput } from './core/types'

export function toPosixPath(file: string): string {
  return file.split(path.win32.sep).join('/')
}

export function createRouteId(file: string): string {
  return toPosixPath(file).replace(/\.[a-z0-9]+$/i, '')
}

export function visitFiles(
  dir: string,
  visitor: (file: string) => void,
  { followSymlinks = true }: { followSymlinks?: boolean } = {},
): void {
  const readStat = followSymlinks ? fs.statSync : fs.lstatSync

  const walk = (currentDir: string) => {
    for (const filename of fs.readdirSync(currentDir)) {
      const file = path.resolve(currentDir, filename)
      const stat = readStat(file)

      if (stat.isDirectory()) {
        walk(file)
      } else if (stat.isFile()) {
        visitor(path.relative(dir, file))
      }
    }
  }

  walk(dir)
}

function normalizeRoutesDir(routeDir: string): string {
  const trimmed = routeDir.trim()

  if (!trimmed) {
    throw new Error(
      `routesDir entries must be non-empty strings. Got: '${routeDir}'`,
    )
  }

  const normalized = trimmed
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/\/+$/, '')

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

  if (normalized.split('/').includes('.')) {
    throw new Error(
      `routesDir entries cannot contain '.' segments. Got: '${routeDir}'`,
    )
  }

  return normalized
}

function normalizeMountPath(mountPath: string): string {
  const normalized = mountPath.trim()

  if (!normalized) {
    throw new Error('routesDir mount paths must be non-empty strings.')
  }

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

// inspired by @react-router/dev/routes
function getAppDirectory(): string {
  return (
    (globalThis as any).__reactRouterAppDirectory ??
    path.resolve(process.cwd(), 'app')
  )
}

export function normalizeRoutesDirOption(
  routesDir: RoutesDirInput = 'routes',
): NormalizedRoutesDir[] {
  const isMapping = typeof routesDir !== 'string'
  const entries = Object.entries(isMapping ? routesDir : { '/': routesDir })
  if (entries.length === 0) {
    throw new Error('routesDir object must contain at least one entry.')
  }

  // A plain string is relative to the app directory; a mapping is relative to
  // the project root.
  const baseDir = isMapping ? process.cwd() : getAppDirectory()
  const seenMountPaths = new Set<string>()

  const normalized = entries.map(([rawMountPath, dir]) => {
    const mountPath = normalizeMountPath(rawMountPath)
    if (seenMountPaths.has(mountPath)) {
      throw new Error(
        `Duplicate routesDir mount path detected: '${mountPath}'.`,
      )
    }
    seenMountPaths.add(mountPath)

    const normalizedDir = normalizeRoutesDir(dir)
    return {
      mountPath,
      normalizedDir,
      fsDir: path.resolve(baseDir, normalizedDir),
    }
  })

  const rootEntry = normalized.find((entry) => entry.mountPath === '/')
  const appDir = rootEntry ? path.dirname(rootEntry.fsDir) : getAppDirectory()

  return normalized.map(({ mountPath, normalizedDir, fsDir }) => {
    const importPrefix = toPosixPath(path.relative(appDir, fsDir))

    return {
      mountPath,
      fsDir,
      idPrefix:
        mountPath === '/' && normalizedDir === 'app/routes'
          ? 'routes'
          : normalizedDir,
      importPrefix,
    }
  })
}
