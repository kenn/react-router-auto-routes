import {
  defaultVisitFiles,
  escapeRegexChar,
  normalizeRoutesDir,
} from '../utils'
import {
  collectRouteInfos,
  normalizeAndAssignParents,
  buildRouteTree,
} from './routing'
import { RouteConfig, autoRoutesOptions, ResolvedOptions } from './types'

export { autoRoutes }
export type { RouteConfig, autoRoutesOptions } from './types'

export default function autoRoutes(
  options: autoRoutesOptions = {},
): RouteConfig[] {
  const resolved = resolveOptions(options)
  const collectedRoutes = collectRouteInfos(resolved)
  const routesWithParents = normalizeAndAssignParents(collectedRoutes)

  return buildRouteTree(routesWithParents)
}

function resolveOptions(options: autoRoutesOptions = {}): ResolvedOptions {
  const {
    rootDir: rawRootDir = 'app',
    routesDir = 'routes',
    basePath = '/',
    paramChar = '$',
    colocateChar: userColocateChar,
    routeRegex: userRouteRegex,
    ignoredRouteFiles = [],
    visitFiles: userVisitFiles,
  } = options

  const colocateChar = userColocateChar ?? '+'
  const visitFiles = userVisitFiles ?? defaultVisitFiles
  const routeRegexSource =
    userRouteRegex ??
    /((\${colocateChar}[\/\\][^\/\\:?*]+)|[\/\\]((index|route|layout|page)|(_[^\/\\:?*]+)|([^\/\\:?*]+\.route)|([^\/\\:?*]+)))\.(ts|tsx|js|jsx|md|mdx)$/

  // Inline regex replacement logic
  const escapedColocateChar = escapeRegexChar(colocateChar)
  const routeRegex = new RegExp(
    routeRegexSource.source.replace(
      '\\${colocateChar}',
      `\\${escapedColocateChar}`,
    ),
    routeRegexSource.flags,
  )

  const rootDir = rawRootDir.trim() === '' ? '.' : rawRootDir.trim()
  const routeDirsArray = Array.isArray(routesDir) ? [...routesDir] : [routesDir]
  const normalizedRouteDirs = routeDirsArray.map((dir) =>
    normalizeRoutesDir(dir),
  )

  return {
    rootDir,
    routeDirs: Object.freeze(normalizedRouteDirs),
    basePath,
    visitFiles,
    paramChar,
    colocateChar,
    ignoredRouteFiles: Object.freeze([...ignoredRouteFiles]),
    routeRegex,
  }
}
