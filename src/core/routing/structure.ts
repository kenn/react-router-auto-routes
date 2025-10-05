import { ROOT_PARENT } from '../constants'
import { RouteConfig, RouteInfo } from '../types'

function nameKey(sourceKey: string, name: string): string {
  return `${sourceKey}::${name}`
}

function isLayoutRoute(route: RouteInfo): boolean {
  const fileName = route.file.split('/').pop() ?? ''
  const withoutExtension = fileName.replace(/\.[^/.]+$/, '')
  const normalized = withoutExtension.endsWith('.route')
    ? withoutExtension.slice(0, -'.route'.length)
    : withoutExtension

  return normalized === '_layout' || normalized === 'layout'
}

function getParentScore(route: RouteInfo): number {
  // Check for route/route.tsx pattern (explicit nested route structure)
  const normalizedFile = route.file.replace(/\\/g, '/')
  if (normalizedFile.includes('/route/route.')) {
    return 4 // Highest priority - explicit route structure
  }

  // Check for layout files (_layout.tsx or layout.tsx)
  if (isLayoutRoute(route)) {
    return 3 // High priority - explicit layout
  }

  // Regular route files
  return 2 // Lower priority
}

function findBestParent(
  child: RouteInfo,
  candidates: RouteInfo[],
): RouteInfo | undefined {
  const eligible = candidates.filter(
    (candidate) => candidate.id !== child.id && !candidate.index,
  )

  if (eligible.length === 0) {
    return undefined
  }

  let best = eligible[0]
  let bestScore = getParentScore(best)

  for (let i = 1; i < eligible.length; i++) {
    const candidate = eligible[i]
    const score = getParentScore(candidate)
    if (score > bestScore) {
      best = candidate
      bestScore = score
    }
  }

  return best
}

export function findParentRouteId(
  routeInfo: RouteInfo,
  nameMap: Map<string, RouteInfo[]>,
): string | undefined {
  let parentName = routeInfo.index
    ? routeInfo.segments.join('/')
    : routeInfo.segments.slice(0, -1).join('/')

  while (parentName) {
    const candidates = nameMap.get(nameKey(routeInfo.sourceKey, parentName))
    if (candidates && candidates.length > 0) {
      const parent = findBestParent(routeInfo, candidates)
      if (parent) {
        return parent.id
      }
    }

    const lastSlashIndex = parentName.lastIndexOf('/')
    if (lastSlashIndex === -1) {
      break
    }
    parentName = parentName.substring(0, lastSlashIndex)
  }

  return undefined
}

function createNameMap(routes: readonly RouteInfo[]): Map<string, RouteInfo[]> {
  const nameMap = new Map<string, RouteInfo[]>()

  for (const route of routes) {
    const key = nameKey(route.sourceKey, route.name)
    const existing = nameMap.get(key)
    if (existing) {
      existing.push(route)
    } else {
      nameMap.set(key, [route])
    }
  }

  return nameMap
}

function shouldNormalizeRoute(route: RouteInfo): boolean {
  if (route.segments.length <= 1 || route.index) {
    return false
  }

  const pathParts = route.relativeId.split('/').filter(Boolean)
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

  const existingParents = nameMap.get(nameKey(route.sourceKey, parentName))
  const hasNonIndexParent = existingParents?.some((parent) => !parent.index)

  if (!hasNonIndexParent) {
    return route.segments.join('/')
  }

  return route.name
}

export function normalizeAndAssignParents(
  routes: readonly RouteInfo[],
): RouteInfo[] {
  const initialNameMap = createNameMap(routes)

  const normalizedRoutes = routes.map((route) => ({
    ...route,
    name: normalizeName(route, initialNameMap),
  }))

  const finalNameMap = createNameMap(normalizedRoutes)

  return normalizedRoutes.map((route) => ({
    ...route,
    parentId: findParentRouteId(route, finalNameMap) ?? ROOT_PARENT,
  }))
}

function groupRoutesByParent(
  routes: readonly RouteInfo[],
): Map<string, RouteInfo[]> {
  const childrenByParent = new Map<string, RouteInfo[]>()

  for (const route of routes) {
    const parentKey = route.parentId ?? ROOT_PARENT
    const children = childrenByParent.get(parentKey)
    if (children) {
      children.push(route)
    } else {
      childrenByParent.set(parentKey, [route])
    }
  }

  return childrenByParent
}

function getParentPath(
  parentId: string | undefined,
  routeMap: Map<string, RouteInfo>,
): string {
  if (!parentId || parentId === ROOT_PARENT) {
    return '/'
  }

  const parentRoute = routeMap.get(parentId)
  if (!parentRoute?.path) {
    return '/'
  }

  return parentRoute.path
}

function computeRelativePath(
  route: RouteInfo,
  routeMap: Map<string, RouteInfo>,
): string | undefined {
  if (!route.path) {
    return undefined
  }

  const parentPath = getParentPath(route.parentId, routeMap)

  if (!route.path.startsWith(parentPath)) {
    const trimmed = route.path.startsWith('/')
      ? route.path.slice(1)
      : route.path
    return trimmed || undefined
  }

  let relative = route.path.slice(parentPath.length)
  if (relative.startsWith('/')) {
    relative = relative.slice(1)
  }

  if (
    route.index &&
    route.parentId &&
    route.parentId !== ROOT_PARENT &&
    !relative
  ) {
    return undefined
  }

  return relative || undefined
}

function createRouteNode(
  route: RouteInfo,
  routeMap: Map<string, RouteInfo>,
  childrenByParent: Map<string, RouteInfo[]>,
  createConfig: (route: RouteInfo) => RouteConfig,
): RouteConfig {
  const node: RouteConfig = {
    id: route.id,
    file: route.file,
  }

  if (route.caseSensitive) {
    node.caseSensitive = true
  }

  const relativePath = computeRelativePath(route, routeMap)
  if (relativePath !== undefined) {
    node.path = relativePath
  }

  if (route.index) {
    node.index = true
  }

  const children = childrenByParent.get(route.id) ?? []
  if (route.index && children.length > 0) {
    throw new Error(
      `Child routes are not allowed in index routes. Please remove child routes of ${route.id}`,
    )
  }

  if (children.length > 0) {
    node.children = children.map(createConfig)
  }

  return node
}

export function buildRouteTree(routes: readonly RouteInfo[]): RouteConfig[] {
  const routeMap = new Map(routes.map((route) => [route.id, route] as const))
  const childrenByParent = groupRoutesByParent(routes)

  const createRouteConfig = (route: RouteInfo): RouteConfig => {
    return createRouteNode(route, routeMap, childrenByParent, createRouteConfig)
  }

  const topLevelRoutes = childrenByParent.get(ROOT_PARENT) ?? []
  return topLevelRoutes.map(createRouteConfig)
}
