import picomatch from 'picomatch'
import * as path from 'path'

import { ROUTE_EXTENSIONS, SERVER_FILE_REGEX } from '../constants'
import { ResolvedOptions, RouteInfo } from '../types'
import { createRouteId, escapeRegexChar, memoizedRegex } from '../../utils'
import { createRoutePath, getRouteSegments } from './segments'

export const routeModuleExts = ROUTE_EXTENSIONS
export const serverRegex = SERVER_FILE_REGEX

function checkColocationViolations(
  segments: string[],
  colocationChar: string,
  filename: string,
): void {
  if (segments.length >= 1 && segments[0].startsWith(colocationChar)) {
    throw new Error(
      `Colocation entries must live inside a route folder. ` +
        `Move '${filename}' under an actual route directory.`,
    )
  }

  let anonymousFolderCount = 0
  for (let i = 0; i < segments.length - 1; i++) {
    if (segments[i] === colocationChar) {
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

function isColocated(segments: string[], colocationChar: string): boolean {
  return segments.some((segment) => segment.startsWith(colocationChar))
}

function hasValidRouteExtension(
  filename: string,
  routeRegex?: RegExp,
): boolean {
  const isFlatFile = !filename.includes(path.sep) && !filename.includes('/')

  if (serverRegex.test(filename)) {
    return false
  }

  if (isFlatFile) {
    return routeModuleExts.includes(path.extname(filename))
  }

  if (routeRegex) {
    return routeRegex.test(filename)
  }

  return routeModuleExts.includes(path.extname(filename))
}

export function isRouteModuleFile(
  filename: string,
  colocationChar: string = '+',
  routeRegex?: RegExp,
): boolean {
  const normalizedPath = filename.replace(/\\/g, '/')
  const segments = normalizedPath.split('/')

  checkColocationViolations(segments, colocationChar, filename)

  if (isColocated(segments, colocationChar)) {
    return false
  }

  return hasValidRouteExtension(filename, routeRegex)
}

export function getRouteRegex(
  RegexRequiresNestedDirReplacement: RegExp,
  colocationChar: string,
): RegExp {
  const escapedColocationChar = escapeRegexChar(colocationChar)
  return new RegExp(
    RegexRequiresNestedDirReplacement.source.replace(
      '\\${colocationChar}',
      `\\${escapedColocationChar}`,
    ),
    RegexRequiresNestedDirReplacement.flags,
  )
}

export function isIndexRoute(routeId: string): boolean {
  const indexRouteRegex = memoizedRegex(
    `((^|[.])(index|_index))($|\\/)|(\\/(_?index))($|\\/)`,
  )
  return indexRouteRegex.test(routeId)
}

export function getRouteInfo(
  routeDir: string,
  file: string,
  options: ResolvedOptions,
): RouteInfo {
  const filePath = path.join(routeDir, file).split(path.win32.sep).join('/')
  const routeId = createRouteId(filePath)
  const routePrefix = `${routeDir}/`
  if (!routeId.startsWith(routePrefix)) {
    throw new Error(
      `Route id '${routeId}' does not start with expected prefix '${routePrefix}'`,
    )
  }
  const routeIdWithoutRoutes = routeId.slice(routePrefix.length)
  const index = isIndexRoute(routeIdWithoutRoutes)
  const routeSegments = getRouteSegments(
    routeIdWithoutRoutes,
    index,
    options.paramChar,
    options.colocationChar,
  )
  const routePath = createRoutePath(routeSegments, index, options)

  return {
    id: routeId,
    root: routeDir,
    relativeId: routeIdWithoutRoutes,
    path: routePath!,
    file: filePath,
    name: routeSegments.join('/'),
    segments: routeSegments,
    index,
  }
}

export function collectRouteInfos(options: ResolvedOptions): RouteInfo[] {
  const {
    rootDir,
    routeDirs,
    ignoredRouteFiles,
    visitFiles,
    colocationChar,
    routeRegex,
  } = options

  const routeMap = new Map<string, RouteInfo>()

  for (const currentRouteDir of routeDirs) {
    const directory = path.join(rootDir, currentRouteDir)

    visitFiles(directory, (file) => {
      if (
        ignoredRouteFiles.length > 0 &&
        ignoredRouteFiles.some((pattern) =>
          picomatch.isMatch(file, pattern, { dot: true }),
        )
      ) {
        return
      }

      if (!isRouteModuleFile(file, colocationChar, routeRegex)) {
        return
      }

      const routeInfo = getRouteInfo(currentRouteDir, file, options)
      const existing = routeMap.get(routeInfo.id)
      if (existing) {
        throw new Error(
          `Duplicate route id '${routeInfo.id}' generated from '${routeInfo.file}' conflicts with '${existing.file}'`,
        )
      }

      routeMap.set(routeInfo.id, routeInfo)
    })
  }

  return Array.from(routeMap.values())
}
