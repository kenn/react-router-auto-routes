import { RouteConfig, RouteInfo } from '../types'

const ROOT_PARENT = 'root'

function isLayoutRoute(route: RouteInfo): boolean {
  const fileName = route.file.split('/').pop() ?? ''
  const normalized = fileName.replace(/\.[^/.]+$/, '')

  return normalized === '_layout' || normalized.endsWith('._layout')
}

const ROUTE_PRIORITY = 2
const LAYOUT_PRIORITY = 3
const ROUTE_DIR_PRIORITY = 4

function parentScore(route: RouteInfo): number {
  if (route.file.includes('/route/route.')) {
    return ROUTE_DIR_PRIORITY
  }

  if (isLayoutRoute(route)) {
    return LAYOUT_PRIORITY
  }

  return ROUTE_PRIORITY
}

function keyFor(mountPath: string, segments: readonly string[]): string {
  return `${mountPath}::${segments.join('/')}`
}

function resolveRelativePath(
  route: RouteInfo,
  parentPath: string | undefined,
): string | undefined {
  if (!route.path) {
    return undefined
  }

  let relative = route.path

  if (parentPath && relative.startsWith(parentPath)) {
    relative = relative.slice(parentPath.length)
    if (relative.startsWith('/')) {
      relative = relative.slice(1)
    }
  } else if (relative.startsWith('/')) {
    relative = relative.slice(1)
  }

  if (route.index && parentPath && !relative) {
    return undefined
  }

  return relative || undefined
}

function segmentSpecificity(segment: string): number {
  if (segment === '*') {
    return 0
  }

  if (segment.startsWith(':')) {
    return segment.endsWith('?') ? 1 : 2
  }

  return segment.endsWith('?') ? 3 : 4
}

function comparePathSpecificity(a: RouteInfo, b: RouteInfo): number {
  if (!a.path || !b.path) {
    return 0
  }

  const left = a.path.split('/').filter(Boolean)
  const right = b.path.split('/').filter(Boolean)
  const length = Math.min(left.length, right.length)

  for (let index = 0; index < length; index++) {
    const specificityDiff =
      segmentSpecificity(right[index]) - segmentSpecificity(left[index])
    if (specificityDiff !== 0) {
      return specificityDiff
    }
  }

  return 0
}

function sortForAssembly(routes: readonly RouteInfo[]): RouteInfo[] {
  return [...routes].sort((a, b) => {
    const depthDiff = a.segments.length - b.segments.length
    if (depthDiff !== 0) {
      return depthDiff
    }

    if (a.index !== b.index) {
      return a.index ? 1 : -1
    }

    const scoreDiff = parentScore(b) - parentScore(a)
    if (scoreDiff !== 0) {
      return scoreDiff
    }

    const specificityDiff = comparePathSpecificity(a, b)
    if (specificityDiff !== 0) {
      return specificityDiff
    }

    return a.id.localeCompare(b.id)
  })
}

export function buildRouteTree(routes: readonly RouteInfo[]): RouteConfig[] {
  const configMap = new Map<string, RouteConfig>()
  const absolutePaths = new Map<string, string | undefined>()
  // Layout routes keyed by mount + segments; children look up parents here.
  const layouts = new Map<string, RouteInfo>()
  const roots: RouteConfig[] = []

  const resolveParentId = (route: RouteInfo): string => {
    // Index routes and segment-less routes may nest under a layout with the
    // exact same segments; everything else looks at strict ancestors.
    const start =
      route.index || route.segments.length === 0
        ? route.segments.length
        : route.segments.length - 1

    for (let length = start; length >= 0; length--) {
      const candidate = layouts.get(
        keyFor(route.mountPath, route.segments.slice(0, length)),
      )
      if (candidate && candidate.id !== route.id) {
        return candidate.id
      }
    }

    return ROOT_PARENT
  }

  for (const route of sortForAssembly(routes)) {
    const parentId = resolveParentId(route)
    const parentConfig = configMap.get(parentId)

    const config: RouteConfig = { id: route.id, file: route.file }
    const relativePath = resolveRelativePath(
      route,
      parentConfig ? absolutePaths.get(parentId) : undefined,
    )
    if (relativePath !== undefined) {
      config.path = relativePath
    }
    if (route.index) {
      config.index = true
    }

    if (!route.index && isLayoutRoute(route)) {
      const key = keyFor(route.mountPath, route.segments)
      // Competing layouts for the same segments: higher score wins, then id.
      const current = layouts.get(key)
      const scoreDiff = current ? parentScore(route) - parentScore(current) : 1
      if (scoreDiff > 0 || (scoreDiff === 0 && route.id < current!.id)) {
        layouts.set(key, route)
      }
    }

    if (parentConfig) {
      if (parentConfig.index) {
        throw new Error(
          `Child routes are not allowed in index routes. Please remove child routes of ${parentConfig.id}`,
        )
      }
      ;(parentConfig.children ??= []).push(config)
    } else {
      roots.push(config)
    }

    configMap.set(route.id, config)
    absolutePaths.set(route.id, route.path)
  }

  return roots
}
