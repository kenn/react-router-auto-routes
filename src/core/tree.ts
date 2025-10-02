import { RouteConfig, RouteInfo } from './types'
import { ROOT_PARENT } from './constants'

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

  if (route.index && route.parentId && route.parentId !== ROOT_PARENT && !relative) {
    return undefined
  }

  return relative || undefined
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
