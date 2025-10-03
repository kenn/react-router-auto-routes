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

const DEFAULT_ROUTE_REGEX =
  /((\${colocateChar}[\/\\][^\/\\:?*]+)|[\/\\]((index|route|layout|page)|(_[^\/\\:?*]+)|([^\/\\:?*]+\.route)|([^\/\\:?*]+)))\.(ts|tsx|js|jsx|md|mdx)$/

function resolveRouteRegex(pattern: RegExp, colocateChar: string): RegExp {
  const escapedColocateChar = escapeRegexChar(colocateChar)
  return new RegExp(
    pattern.source.replace('\\${colocateChar}', `\\${escapedColocateChar}`),
    pattern.flags,
  )
}

export default function autoRoutes(
  options: autoRoutesOptions = {},
): RouteConfig[] {
  const {
    rootDir: rawRootDir = 'app',
    routesDir = 'routes',
    paramChar = '$',
    colocateChar: userColocateChar,
    routeRegex: userRouteRegex,
    ignoredRouteFiles = [],
    visitFiles: userVisitFiles,
  } = options

  const colocateChar = userColocateChar ?? '+'
  const visitFiles = userVisitFiles ?? defaultVisitFiles
  const routeRegex = resolveRouteRegex(
    userRouteRegex ?? DEFAULT_ROUTE_REGEX,
    colocateChar,
  )

  const rootDir = rawRootDir.trim() === '' ? '.' : rawRootDir.trim()
  const routeDirsArray = Array.isArray(routesDir) ? [...routesDir] : [routesDir]
  const normalizedRouteDirs = routeDirsArray.map((dir) =>
    normalizeRoutesDir(dir),
  )

  const resolved: ResolvedOptions = {
    rootDir,
    routeDirs: normalizedRouteDirs,
    visitFiles,
    paramChar,
    colocateChar,
    ignoredRouteFiles: [...ignoredRouteFiles],
    routeRegex,
  }

  const collectedRoutes = collectRouteInfos(resolved)
  const routesWithParents = normalizeAndAssignParents(collectedRoutes)

  return buildRouteTree(routesWithParents)
}
