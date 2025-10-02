import * as path from 'path'
import { RouteInfo, autoRoutesOptions } from './types'
import { createRouteId, normalizeSlashes } from '../utils'
import { isIndexRoute } from './route-detection'
import { createRoutePath, getRouteSegments } from './route-path'

export function getRouteInfo(
  routeDir: string,
  file: string,
  options: autoRoutesOptions,
): RouteInfo {
  let filePath = normalizeSlashes(path.join(routeDir, file))
  let routeId = createRouteId(filePath)
  let routeIdWithoutRoutes = routeId.slice(routeDir.length + 1)
  let index = isIndexRoute(routeIdWithoutRoutes, options)
  let routeSegments = getRouteSegments(
    routeIdWithoutRoutes,
    index,
    options.paramChar,
    options.colocateChar,
  )
  let routePath = createRoutePath(routeSegments, index, options)
  let routeInfo = {
    id: routeId,
    path: routePath!,
    file: filePath,
    name: routeSegments.join('/'),
    segments: routeSegments,
    index,
  }

  return routeInfo
}

export function findParentRouteId(
  routeInfo: RouteInfo,
  nameMap: Map<string, RouteInfo>,
): string | undefined {
  let parentName = routeInfo.segments.slice(0, -1).join('/')
  while (parentName) {
    if (nameMap.has(parentName)) {
      const parent = nameMap.get(parentName)!
      return parent.id
    }
    parentName = parentName.substring(0, parentName.lastIndexOf('/'))
  }
  return undefined
}
