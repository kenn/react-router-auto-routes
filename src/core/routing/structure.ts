import { RouteConfig, RouteInfo } from '../types'
import { ROOT_PARENT } from './constants'

function isLayoutRoute(route: RouteInfo): boolean {
  const fileName = route.file.split('/').pop() ?? ''
  const withoutExtension = fileName.replace(/\.[^/.]+$/, '')
  const normalized = withoutExtension.endsWith('.route')
    ? withoutExtension.slice(0, -'.route'.length)
    : withoutExtension

  return (
    normalized === '_layout' ||
    normalized === 'layout' ||
    normalized.endsWith('._layout') ||
    normalized.endsWith('.layout')
  )
}

const ROUTE_PRIORITY = 2
const LAYOUT_PRIORITY = 3
const ROUTE_DIR_PRIORITY = 4

function parentScore(route: RouteInfo): number {
  const normalizedFile = route.file.replace(/\\/g, '/')
  if (normalizedFile.includes('/route/route.')) {
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

    return a.id.localeCompare(b.id)
  })
}

export function buildRouteTree(routes: readonly RouteInfo[]): RouteConfig[] {
  const sortedRoutes = sortForAssembly(routes)
  const configMap = new Map<string, RouteConfig>()
  const absolutePaths = new Map<string, string | undefined>()
  const parentLookup = new Map<string, RouteInfo>()
  const roots: RouteConfig[] = []

  const resolveParentId = (route: RouteInfo): string => {
    let parentId: string | undefined

    if (route.index) {
      parentId = parentLookup.get(keyFor(route.mountPath, route.segments))?.id
    }

    if (!parentId) {
      for (let length = route.segments.length - 1; length > 0; length--) {
        const candidate = parentLookup.get(
          keyFor(route.mountPath, route.segments.slice(0, length)),
        )
        if (candidate && candidate.id !== route.id) {
          parentId = candidate.id
          break
        }
      }
    }

    return parentId ?? ROOT_PARENT
  }

  for (const route of sortedRoutes) {
    const parentId = resolveParentId(route)
    const parentPath =
      parentId === ROOT_PARENT ? '/' : absolutePaths.get(parentId)

    const config: RouteConfig = {
      id: route.id,
      file: route.file,
    }

    const relativePath = resolveRelativePath(
      route,
      parentPath === '/' ? undefined : parentPath,
    )
    if (relativePath !== undefined) {
      config.path = relativePath
    }

    if (route.index) {
      config.index = true
    }

    if (!route.index) {
      const key = keyFor(route.mountPath, route.segments)
      const current = parentLookup.get(key)
      const score = parentScore(route)
      if (!current) {
        parentLookup.set(key, route)
      } else {
        const currentScore = parentScore(current)
        if (
          score > currentScore ||
          (score === currentScore && route.id < current.id)
        ) {
          parentLookup.set(key, route)
        }
      }
    }

    if (parentId === ROOT_PARENT) {
      roots.push(config)
      configMap.set(route.id, config)
      absolutePaths.set(route.id, route.path)
      continue
    }

    const parentConfig = configMap.get(parentId)
    if (!parentConfig) {
      roots.push(config)
      configMap.set(route.id, config)
      absolutePaths.set(route.id, route.path)
      continue
    }

    if (parentConfig.index) {
      throw new Error(
        `Child routes are not allowed in index routes. Please remove child routes of ${parentConfig.id}`,
      )
    }

    if (!parentConfig.children) {
      parentConfig.children = []
    }
    parentConfig.children.push(config)
    configMap.set(route.id, config)
    absolutePaths.set(route.id, route.path)
  }

  return roots
}
