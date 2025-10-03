import { resolveOptions } from './options'
import {
  collectRouteInfos,
  normalizeAndAssignParents,
  buildRouteTree,
} from './routing'
import { RouteConfig, autoRoutesOptions } from './types'

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
