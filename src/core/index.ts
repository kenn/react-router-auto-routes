import {
  defaultVisitFiles,
  normalizeRoutesDirOption,
  resolveRouteRegex,
} from '../utils'
import { buildRouteTree, collectRouteInfos } from './routing'
import { autoRoutesOptions, ResolvedOptions, RouteConfig } from './types'

export type { autoRoutesOptions, RouteConfig } from './types'
export { autoRoutes }

const DEFAULT_ROUTE_REGEX =
  /((\${colocationChar}[\/\\][^\/\\:?*]+)|[\/\\]((index|route|layout)|(_[^\/\\:?*]+)|([^\/\\:?*]+\.route)|([^\/\\:?*]+)))\.(ts|tsx|js|jsx|md|mdx)$/

export default function autoRoutes(
  options: autoRoutesOptions = {},
): RouteConfig[] {
  const {
    routesDir,
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

  const routes = normalizeRoutesDirOption(routesDir)

  const resolved: ResolvedOptions = {
    routes,
    visitFiles,
    paramChar,
    colocationChar,
    ignoredRouteFiles: [...ignoredRouteFiles],
    routeRegex,
  }

  const collectedRoutes = collectRouteInfos(resolved)

  return buildRouteTree(collectedRoutes)
}
