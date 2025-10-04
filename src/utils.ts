import * as fs from 'fs'
import * as path from 'path'

import { NormalizedRoutesDir, RoutesDirInput } from './core/types'

const regexCache: { [key: string]: RegExp } = {}

export function memoizedRegex(input: string): RegExp {
  if (input in regexCache) {
    return regexCache[input]
  }

  const newRegex = new RegExp(input)
  regexCache[input] = newRegex

  return newRegex
}

export function defaultVisitFiles(
  dir: string,
  visitor: (file: string) => void,
) {
  const rootDir = dir

  const walk = (currentDir: string) => {
    for (const filename of fs.readdirSync(currentDir)) {
      const file = path.resolve(currentDir, filename)
      const stat = fs.statSync(file)

      if (stat.isDirectory()) {
        walk(file)
      } else if (stat.isFile()) {
        visitor(path.relative(rootDir, file))
      }
    }
  }

  walk(dir)
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
  if (
    segments.some(
      (segment) => segment === '' || segment === '.' || segment === '..',
    )
  ) {
    throw new Error(
      `routesDir entries cannot contain '.' or '..' segments. Got: '${routeDir}'`,
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

function resolveBaseDir(configDir?: string): string {
  if (!configDir) {
    return process.cwd()
  }

  return path.isAbsolute(configDir)
    ? configDir
    : path.resolve(process.cwd(), configDir)
}

type RoutesDirEntry = {
  mountPath: string
  dir: string
}

function toRoutesDirEntries(
  routesDir: RoutesDirInput | undefined,
): RoutesDirEntry[] {
  if (routesDir === undefined) {
    return [{ mountPath: '/', dir: 'app/routes' }]
  }

  if (typeof routesDir === 'string') {
    return [{ mountPath: '/', dir: routesDir }]
  }

  if (Array.isArray(routesDir)) {
    const entries: RoutesDirEntry[] = []
    for (const value of routesDir) {
      if (typeof value === 'string') {
        entries.push({ mountPath: '/', dir: value })
        continue
      }

      if (value && typeof value === 'object') {
        const record = value as Record<string, string>
        for (const [mountPath, dir] of Object.entries(record)) {
          entries.push({ mountPath, dir })
        }
        continue
      }

      throw new Error(
        `routesDir array entries must be strings or objects. Got: '${value}'`,
      )
    }
    if (entries.length === 0) {
      throw new Error('routesDir array must contain at least one entry.')
    }
    return entries
  }

  const entries: RoutesDirEntry[] = []
  const record = routesDir as Record<string, string>
  for (const [mountPath, dir] of Object.entries(record)) {
    entries.push({ mountPath, dir })
  }

  if (entries.length === 0) {
    throw new Error('routesDir object must contain at least one entry.')
  }

  return entries
}

export function normalizeRoutesDirOption(
  routesDir: RoutesDirInput | undefined,
  configDir?: string,
): NormalizedRoutesDir[] {
  const baseDir = resolveBaseDir(configDir)
  const seenMountPaths = new Set<string>()

  return toRoutesDirEntries(routesDir).map(({ mountPath, dir }) => {
    const normalizedMount = normalizeMountPath(mountPath)
    if (seenMountPaths.has(normalizedMount)) {
      throw new Error(
        `Duplicate routesDir mount path detected: '${normalizedMount}'.`,
      )
    }
    seenMountPaths.add(normalizedMount)

    const normalizedDir = normalizeRoutesDir(dir)
    const fsDir = path.resolve(baseDir, normalizedDir)

    return {
      mountPath: normalizedMount,
      fsDir,
      idPrefix: normalizedDir,
    }
  })
}

export function escapeRegexChar(char: string): string {
  return char.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&')
}
