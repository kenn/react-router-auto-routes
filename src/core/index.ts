import { normalizeRoutesDirOption, visitFiles } from '../utils'
import { collectRouteInfos } from './routing/files'
import { buildRouteTree } from './routing/structure'
import { autoRoutesOptions, RouteConfig } from './types'

export type { autoRoutesOptions, RouteConfig } from './types'
export { autoRoutes }

// Accepts any route-module extension whose basename has no reserved
// characters (`:`, `?`, `*`). Colocated files are filtered out separately.
const DEFAULT_ROUTE_REGEX = /[\/\\][^\/\\:?*]+\.(ts|tsx|js|jsx|md|mdx)$/

export default function autoRoutes(
  options: autoRoutesOptions = {},
): RouteConfig[] {
  const routeInfos = collectRouteInfos({
    routes: normalizeRoutesDirOption(options.routesDir),
    visitFiles: options.visitFiles ?? visitFiles,
    paramChar: options.paramChar ?? '$',
    colocationChar: options.colocationChar ?? '+',
    ignoredRouteFiles: options.ignoredRouteFiles ?? [],
    // Clone so lastIndex resets never touch the caller's regex.
    routeRegex: new RegExp(options.routeRegex ?? DEFAULT_ROUTE_REGEX),
  })

  return buildRouteTree(routeInfos)
}
