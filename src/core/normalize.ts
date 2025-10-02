import { findParentRouteId } from './route-info'
import { RouteInfo } from './types'

export function createNameMap(
  routes: readonly RouteInfo[],
): Map<string, RouteInfo[]> {
  const nameMap = new Map<string, RouteInfo[]>()

  for (const route of routes) {
    const existing = nameMap.get(route.name)
    if (existing) {
      existing.push(route)
    } else {
      nameMap.set(route.name, [route])
    }
  }

  return nameMap
}

export function normalizeFolderRoutes(
  routes: readonly RouteInfo[],
  nameMap: Map<string, RouteInfo[]>,
): RouteInfo[] {
  return routes.map((route) => {
    const normalizedRoute: RouteInfo = { ...route }

    if (normalizedRoute.segments.length <= 1 || normalizedRoute.index) {
      return normalizedRoute
    }

    const pathParts = normalizedRoute.id.split('/').slice(1)
    const usesSpecialSyntax = pathParts.some((part) =>
      part.includes('.') || part.includes('(') || part.includes(')'),
    )

    if (usesSpecialSyntax) {
      return normalizedRoute
    }

    const parentSegments = normalizedRoute.segments.slice(0, -1)
    const parentName = parentSegments.join('/')
    if (!parentName) {
      return normalizedRoute
    }

    const existingParents = nameMap.get(parentName)
    const hasNonIndexParent = existingParents?.some((parent) => !parent.index)

    if (!hasNonIndexParent) {
      normalizedRoute.name = normalizedRoute.segments.join('/')
    }

    return normalizedRoute
  })
}

export function assignParentIds(
  routes: readonly RouteInfo[],
  nameMap: Map<string, RouteInfo[]>,
): RouteInfo[] {
  return routes.map((route) => {
    const parentId = findParentRouteId(route, nameMap)
    return {
      ...route,
      parentId: parentId ?? 'root',
    }
  })
}
