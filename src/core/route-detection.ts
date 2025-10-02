import * as path from 'path'
import { autoRoutesOptions } from './types'
import { memoizedRegex, escapeRegexChar } from '../utils'

export const routeModuleExts = ['.js', '.jsx', '.ts', '.tsx', '.md', '.mdx']
export const serverRegex = /\.server\.(ts|tsx|js|jsx|md|mdx)$/

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
  // Normalize path separators to forward slashes for consistent processing
  const normalizedPath = filename.replace(/\\/g, '/')
  const segments = normalizedPath.split('/')

  // Root-level guard: Check if file/folder at routes root starts with prefix
  if (segments.length === 1 && segments[0].startsWith(colocateChar)) {
    throw new Error(
      `Colocation entries must live inside a route folder. ` +
        `Move '${filename}' under an actual route directory.`,
    )
  }

  // Check if first segment (folder at root) starts with prefix
  if (segments.length > 1 && segments[0].startsWith(colocateChar)) {
    throw new Error(
      `Colocation entries must live inside a route folder. ` +
        `Move '${filename}' under an actual route directory.`,
    )
  }

  // Track anonymous colocation folders to detect nesting
  let anonymousFolderCount = 0
  let hasColocation = false

  // First pass: check for errors
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const isLastSegment = i === segments.length - 1

    // Check for anonymous colocation folder (exactly matches prefix, not starting with)
    if (!isLastSegment && segment === colocateChar) {
      anonymousFolderCount++
      if (anonymousFolderCount > 1) {
        throw new Error(
          `Nested anonymous colocation folders (+/+/) are not allowed. ` +
            `Use named folders like +/components/ instead. Found in: ${filename}`,
        )
      }
    }

    // If any segment (folder or file) starts with prefix, it's colocated
    if (segment.startsWith(colocateChar)) {
      hasColocation = true
    }
  }

  // If any colocation detected, this is not a route
  if (hasColocation) {
    return false
  }

  // File is not colocated, check if it's a valid route module
  // Flat files only need correct extension
  let isFlatFile = !filename.includes(path.sep) && !filename.includes('/')
  if (isFlatFile) {
    return routeModuleExts.includes(path.extname(filename))
  }

  // Check if it's a server file (should be ignored)
  if (serverRegex.test(filename)) {
    return false
  }

  // For nested files, use routeRegex if provided, otherwise check extension
  if (routeRegex) {
    return routeRegex.test(filename)
  }

  // Fallback: Check if it has a valid route module extension
  return routeModuleExts.includes(path.extname(filename))
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

export function getRouteRegex(
  RegexRequiresNestedDirReplacement: RegExp,
  colocateChar: string,
): RegExp {
  // Escape special regex characters in prefix
  const escapedColocateChar = escapeRegexChar(colocateChar)

  return new RegExp(
    RegexRequiresNestedDirReplacement.source.replace(
      '\\${colocateChar}',
      `\\${escapedColocateChar}`,
    ),
    RegexRequiresNestedDirReplacement.flags,
  )
}
