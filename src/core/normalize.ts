import { findParentRouteId } from './route-info'
import { RouteInfo } from './types'
import { ROOT_PARENT } from './constants'

function createNameMap(routes: readonly RouteInfo[]): Map<string, RouteInfo[]> {
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

function shouldNormalizeRoute(route: RouteInfo): boolean {
  if (route.segments.length <= 1 || route.index) {
    return false
  }

  const pathParts = route.id.split('/').slice(1)
  const usesSpecialSyntax = pathParts.some(
    (part) => part.includes('.') || part.includes('(') || part.includes(')'),
  )

  return !usesSpecialSyntax
}

function normalizeName(
  route: RouteInfo,
  nameMap: Map<string, RouteInfo[]>,
): string {
  if (!shouldNormalizeRoute(route)) {
    return route.name
  }

  const parentSegments = route.segments.slice(0, -1)
  const parentName = parentSegments.join('/')
  if (!parentName) {
    return route.name
  }

  const existingParents = nameMap.get(parentName)
  const hasNonIndexParent = existingParents?.some((parent) => !parent.index)

  // If no non-index parent exists, flatten the route name
  if (!hasNonIndexParent) {
    return route.segments.join('/')
  }

  return route.name
}

/**
 * Normalizes routes and assigns parent IDs in a single pass.
 * - Flattens nested folder routes without parents (api/users.ts -> api.users)
 * - Assigns parent IDs based on segment hierarchy
 */
export function normalizeAndAssignParents(
  routes: readonly RouteInfo[],
): RouteInfo[] {
  // First pass: create initial name map
  const initialNameMap = createNameMap(routes)

  // Second pass: normalize names
  const normalizedRoutes = routes.map((route) => ({
    ...route,
    name: normalizeName(route, initialNameMap),
  }))

  // Third pass: create name map from normalized routes and assign parents
  const finalNameMap = createNameMap(normalizedRoutes)

  return normalizedRoutes.map((route) => ({
    ...route,
    parentId: findParentRouteId(route, finalNameMap) ?? ROOT_PARENT,
  }))
}
