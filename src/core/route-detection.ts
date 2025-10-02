import * as path from 'path'
import { autoRoutesOptions } from './types'
import { memoizedRegex, escapeRegexChar } from '../utils'
import { ROUTE_EXTENSIONS, SERVER_FILE_REGEX } from './constants'

export const routeModuleExts = ROUTE_EXTENSIONS
export const serverRegex = SERVER_FILE_REGEX

function checkColocationViolations(
  segments: string[],
  colocateChar: string,
  filename: string,
): void {
  // Root-level colocation not allowed
  if (segments.length >= 1 && segments[0].startsWith(colocateChar)) {
    throw new Error(
      `Colocation entries must live inside a route folder. ` +
        `Move '${filename}' under an actual route directory.`,
    )
  }

  // Check for nested anonymous colocation folders (+/+/)
  let anonymousFolderCount = 0
  for (let i = 0; i < segments.length - 1; i++) {
    if (segments[i] === colocateChar) {
      anonymousFolderCount++
      if (anonymousFolderCount > 1) {
        throw new Error(
          `Nested anonymous colocation folders (+/+/) are not allowed. ` +
            `Use named folders like +/components/ instead. Found in: ${filename}`,
        )
      }
    }
  }
}

function isColocated(segments: string[], colocateChar: string): boolean {
  return segments.some((segment) => segment.startsWith(colocateChar))
}

function hasValidRouteExtension(filename: string, routeRegex?: RegExp): boolean {
  const isFlatFile = !filename.includes(path.sep) && !filename.includes('/')

  // Server files are never valid routes
  if (serverRegex.test(filename)) {
    return false
  }

  // Flat files only need correct extension
  if (isFlatFile) {
    return routeModuleExts.includes(path.extname(filename))
  }

  // For nested files, use routeRegex if provided, otherwise check extension
  if (routeRegex) {
    return routeRegex.test(filename)
  }

  return routeModuleExts.includes(path.extname(filename))
}

/**
 * Determines if a file is a route module using the prefix-based colocation pattern.
 *
 * Prefix-based colocation rules:
 * - Files/folders starting with colocateChar (default +) are colocated (ignored)
 * - Root-level colocation (e.g., routes/+utils.ts) is prohibited
 * - Nested anonymous folders (e.g., +/+/) are prohibited
 *
 * @param filename - Relative path from route directory (e.g., "dashboard/+utils.ts")
 * @param colocateChar - The colocation prefix character (default "+")
 * @param routeRegex - The regex pattern to match valid route files
 * @returns true if file is a route module, false if colocated
 * @throws Error if file violates colocation rules
 */
export function isRouteModuleFile(
  filename: string,
  colocateChar: string = '+',
  routeRegex?: RegExp,
): boolean {
  const normalizedPath = filename.replace(/\\/g, '/')
  const segments = normalizedPath.split('/')

  // Check for colocation rule violations (throws errors)
  checkColocationViolations(segments, colocateChar, filename)

  // If colocated, it's not a route module
  if (isColocated(segments, colocateChar)) {
    return false
  }

  // Check if it has valid route extension/pattern
  return hasValidRouteExtension(filename, routeRegex)
}

export function isIndexRoute(
  routeId: string,
  options: autoRoutesOptions,
): boolean {
  // Check for index routes:
  // - .index or ._index at the end (flat-files) or before /route or /index
  // - /index or /_index at the end (folders)
  const indexRouteRegex = memoizedRegex(
    `((^|[.])(index|_index))($|\\/)|(\\/(_?index))($|\\/)`,
  )
  return indexRouteRegex.test(routeId)
}

// Keep for backwards compatibility with tests
export function getRouteRegex(
  RegexRequiresNestedDirReplacement: RegExp,
  colocateChar: string,
): RegExp {
  const escapedColocateChar = escapeRegexChar(colocateChar)
  return new RegExp(
    RegexRequiresNestedDirReplacement.source.replace(
      '\\${colocateChar}',
      `\\${escapedColocateChar}`,
    ),
    RegexRequiresNestedDirReplacement.flags,
  )
}
