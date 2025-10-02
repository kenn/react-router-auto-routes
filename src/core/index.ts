import { collectRouteInfos } from './collector'
import { resolveOptions } from './options'
import {
  assignParentIds,
  createNameMap,
  normalizeFolderRoutes,
} from './normalize'
import { buildRouteTree } from './tree'
import { RouteConfig, autoRoutesOptions } from './types'

export { autoRoutes }
export type { RouteConfig, autoRoutesOptions } from './types'

export default function autoRoutes(
  options: autoRoutesOptions = {},
): RouteConfig[] {
  const resolved = resolveOptions(options)
  const collectedRoutes = collectRouteInfos(resolved)
  const preNormalizedNameMap = createNameMap(collectedRoutes)
  const normalizedRoutes = normalizeFolderRoutes(
    collectedRoutes,
    preNormalizedNameMap,
  )
  const nameMap = createNameMap(normalizedRoutes)
  const routesWithParents = assignParentIds(normalizedRoutes, nameMap)

  return buildRouteTree(routesWithParents)
}
