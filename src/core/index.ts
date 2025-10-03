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
  /((\${colocationChar}[\/\\][^\/\\:?*]+)|[\/\\]((index|route|layout|page)|(_[^\/\\:?*]+)|([^\/\\:?*]+\.route)|([^\/\\:?*]+)))\.(ts|tsx|js|jsx|md|mdx)$/

function resolveRouteRegex(pattern: RegExp, colocationChar: string): RegExp {
  const escapedColocationChar = escapeRegexChar(colocationChar)
  return new RegExp(
    pattern.source.replace('\\${colocationChar}', `\\${escapedColocationChar}`),
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
    colocationChar: userColocationChar,
    routeRegex: userRouteRegex,
    ignoredRouteFiles = [],
    visitFiles: userVisitFiles,
  } = options

  const colocationChar = userColocationChar ?? '+'
  const visitFiles = userVisitFiles ?? defaultVisitFiles
  const routeRegex = resolveRouteRegex(
    userRouteRegex ?? DEFAULT_ROUTE_REGEX,
    colocationChar,
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
    colocationChar,
    ignoredRouteFiles: [...ignoredRouteFiles],
    routeRegex,
  }

  const collectedRoutes = collectRouteInfos(resolved)
  const routesWithParents = normalizeAndAssignParents(collectedRoutes)

  return buildRouteTree(routesWithParents)
}
