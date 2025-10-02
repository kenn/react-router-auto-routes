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
  baseDir = dir,
) {
  for (let filename of fs.readdirSync(dir)) {
    let file = path.resolve(dir, filename)
    let stat = fs.statSync(file)

    if (stat.isDirectory()) {
      defaultVisitFiles(file, visitor, baseDir)
    } else if (stat.isFile()) {
      visitor(path.relative(baseDir, file))
    }
  }
}

export function createRouteId(file: string): string {
  const normalized = file.split(path.win32.sep).join('/')
  return normalized.replace(/\.[a-z0-9]+$/i, '')
}

export function validateRouteDir(routeDir: string) {
  if (!routeDir) {
    return routeDir
  }

  if (routeDir.includes('/') || routeDir.includes('\\')) {
    throw new Error(
      `routeDir must be a single directory name without path separators. Got: '${routeDir}'`,
    )
  }

  return routeDir
}

export function escapeRegexChar(char: string): string {
  return char.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&')
}
