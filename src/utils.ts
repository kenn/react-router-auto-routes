import * as fs from 'fs'
import * as path from 'path'

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
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(
      `routesDir entries cannot contain '.' or '..' segments. Got: '${routeDir}'`,
    )
  }

  return normalized
}

export function escapeRegexChar(char: string): string {
  return char.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&')
}
