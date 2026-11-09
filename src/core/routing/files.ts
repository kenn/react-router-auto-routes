import * as path from 'path'
import picomatch from 'picomatch'
import { createRouteId, toPosixPath } from '../../utils'
import { NormalizedRoutesDir, ResolvedOptions, RouteInfo } from '../types'
import { getRouteSegments } from './segments'

export const ROUTE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.md', '.mdx']

const SERVER_FILE_REGEX = /\.server\.(ts|tsx|js|jsx|md|mdx)$/
const INDEX_ROUTE_REGEX = /((^|[.])(index|_index))($|\/)|(\/(_?index))($|\/)/

function checkColocationViolations(
  segments: string[],
  colocationChar: string,
  filename: string,
): void {
  if (segments[0].startsWith(colocationChar)) {
    throw new Error(
      `Colocation entries must live inside a route folder. ` +
        `Move '${filename}' under an actual route directory.`,
    )
  }

  const anonymousFolders = segments
    .slice(0, -1)
    .filter((segment) => segment === colocationChar)
  if (anonymousFolders.length > 1) {
    throw new Error(
      `Nested anonymous colocation folders (+/+/) are not allowed. ` +
        `Use named folders like +/components/ instead. Found in: ${filename}`,
    )
  }
}

function isRouteModuleFile(
  filename: string,
  colocationChar: string,
  routeRegex: RegExp,
): boolean {
  const segments = toPosixPath(filename).split('/')

  checkColocationViolations(segments, colocationChar, filename)

  if (segments.some((segment) => segment.startsWith(colocationChar))) {
    return false
  }

  if (SERVER_FILE_REGEX.test(filename)) {
    return false
  }

  // Flat files skip routeRegex; it only constrains files inside folders.
  if (segments.length === 1) {
    return ROUTE_EXTENSIONS.includes(path.extname(filename))
  }

  // `g`/`y` regexes advance lastIndex; every file must be tested from the
  // start (this also keeps `y` anchored to the beginning of the path).
  routeRegex.lastIndex = 0
  return routeRegex.test(filename)
}

function applyMountPath(
  routePath: string | undefined,
  mountPath: string,
): string | undefined {
  if (mountPath === '/') {
    return routePath
  }

  if (!routePath) {
    return mountPath
  }

  return routePath.startsWith('/')
    ? `${mountPath}${routePath}`
    : `${mountPath}/${routePath}`
}

function getRouteInfo(
  routeDir: NormalizedRoutesDir,
  file: string,
  options: ResolvedOptions,
): RouteInfo {
  const routeId = createRouteId(toPosixPath(path.join(routeDir.idPrefix, file)))
  const routePrefix = `${routeDir.idPrefix}/`
  if (!routeId.startsWith(routePrefix)) {
    throw new Error(
      `Route id '${routeId}' does not start with expected prefix '${routePrefix}'`,
    )
  }
  const routeIdWithoutRoutes = routeId.slice(routePrefix.length)
  const index = INDEX_ROUTE_REGEX.test(routeIdWithoutRoutes)
  const { segments, path: routePath } = getRouteSegments(
    routeIdWithoutRoutes,
    index,
    options.paramChar,
  )

  return {
    id: routeId,
    path: applyMountPath(routePath, routeDir.mountPath),
    file: toPosixPath(path.join(routeDir.importPrefix, file)),
    segments,
    mountPath: routeDir.mountPath,
    index,
  }
}

export function collectRouteInfos(options: ResolvedOptions): RouteInfo[] {
  const { routes, ignoredRouteFiles, visitFiles, colocationChar, routeRegex } =
    options

  const routeMap = new Map<string, RouteInfo>()

  for (const currentRouteDir of routes) {
    visitFiles(currentRouteDir.fsDir, (file) => {
      if (
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
