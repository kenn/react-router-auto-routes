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

export function createRouteId(file: string) {
  return normalizeSlashes(stripFileExtension(file))
}

export function normalizeSlashes(file: string) {
  return file.split(path.win32.sep).join('/')
}

function stripFileExtension(file: string) {
  return file.replace(/\.[a-z0-9]+$/i, '')
}

// Helper to escape regex special characters
export function escapeRegexChar(char: string): string {
  return char.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&')
}
