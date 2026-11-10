import { getRouteSegments } from '../../../src/core/routing/segments'
import { scanRouteModules } from './route-scanner'

const DOT_INDEX_SUFFIX = '.index'
const DOT_UNDERSCORE_INDEX_SUFFIX = '._index'

export type ConfigRoute = {
  path?: string
  index?: boolean
  id: string
  parentId: string
  file: string
}

export type RouteManifest = Record<string, ConfigRoute>

export type CreateRoutesFromFoldersOptions = {
  /** The directory where your app lives. @default "app" */
  appDirectory?: string
  /** Glob patterns to ignore when looking for route modules. */
  ignoredFilePatterns?: string[]
  /** The routes directory, relative to `appDirectory`. @default "routes" */
  routesDirectory?: string
}

/**
 * Builds the legacy (remix-flat-routes folder convention) route manifest for
 * `app/routes`. A `.` in a filename is a URL `/` without nesting, `$` is a
 * dynamic segment, and subdirectories create nested routes.
 */
export function createRoutesFromFolders(
  options: CreateRoutesFromFoldersOptions = {},
): RouteManifest {
  const {
    appDirectory = 'app',
    ignoredFilePatterns = [],
    routesDirectory = 'routes',
  } = options

  const files = scanRouteModules({
    appDirectory,
    routesDirectory,
    ignoredFilePatterns,
  })

  const routeIds = Object.keys(files).sort(byLongestFirst)
  const childrenByParent = groupByParent(routeIds)
  const seenRoutes = new Map<string, string>()
  const routes: RouteManifest = Object.create(null)

  const defineNestedRoutes = (parentId: string | undefined) => {
    for (const routeId of childrenByParent.get(parentId) ?? []) {
      const routePath = createRoutePath(
        routeId.slice((parentId || routesDirectory).length + 1),
      )
      const isIndexRoute = isIndexRouteId(routeId)
      const fullPath = createRoutePath(
        routeId.slice(routesDirectory.length + 1),
      )

      ensureUniqueRoute(seenRoutes, {
        id: routeId,
        fullPath: fullPath || '/',
        uniqueKey: (fullPath || '') + (isIndexRoute ? '?index' : ''),
        isPathlessLayoutRoute:
          routeId.split('/').pop()?.startsWith('__') === true,
      })

      if (isIndexRoute && childrenByParent.has(routeId)) {
        throw new Error(
          `Child routes are not allowed in index routes. Please remove child routes of ${routeId}`,
        )
      }

      routes[routeId] = {
        path: routePath || undefined,
        index: isIndexRoute || undefined,
        id: routeId,
        parentId: parentId ?? 'root',
        file: files[routeId],
      }

      if (!isIndexRoute) {
        defineNestedRoutes(routeId)
      }
    }
  }

  defineNestedRoutes(undefined)
  return routes
}

export { createRoutePath }

function findParentRouteId(
  routeId: string,
  knownIds: Set<string>,
): string | undefined {
  // The nearest folder ancestor wins.
  for (
    let index = routeId.lastIndexOf('/');
    index > 0;
    index = routeId.lastIndexOf('/', index - 1)
  ) {
    const candidate = routeId.slice(0, index)
    if (knownIds.has(candidate)) {
      return candidate
    }
  }

  // Dot-notation index routes nest under their dotted parent.
  for (const suffix of [DOT_INDEX_SUFFIX, DOT_UNDERSCORE_INDEX_SUFFIX]) {
    if (routeId.endsWith(suffix)) {
      const candidate = routeId.slice(0, -suffix.length)
      if (knownIds.has(candidate)) {
        return candidate
      }
    }
  }

  return undefined
}

/** Groups route ids by parent id, preserving the order of `routeIds`. */
function groupByParent(routeIds: string[]): Map<string | undefined, string[]> {
  const knownIds = new Set(routeIds)
  const children = new Map<string | undefined, string[]>()

  for (const routeId of routeIds) {
    const parentId = findParentRouteId(routeId, knownIds)
    const siblings = children.get(parentId)
    if (siblings) {
      siblings.push(routeId)
    } else {
      children.set(parentId, [routeId])
    }
  }

  return children
}

function byLongestFirst(a: string, b: string): number {
  return b.length - a.length
}

type UniqueRouteContext = {
  id: string
  uniqueKey: string | undefined
  fullPath: string
  isPathlessLayoutRoute: boolean
}

function ensureUniqueRoute(
  seen: Map<string, string>,
  context: UniqueRouteContext,
): void {
  if (!context.uniqueKey || context.isPathlessLayoutRoute) {
    return
  }

  const conflict = seen.get(context.uniqueKey)
  if (conflict) {
    throw new Error(
      `Path ${JSON.stringify(context.fullPath)} defined by route ` +
        `${JSON.stringify(context.id)} conflicts with route ` +
        `${JSON.stringify(conflict)}`,
    )
  }

  seen.set(context.uniqueKey, context.id)
}

function createRoutePath(partialRouteId: string): string | undefined {
  validatePartialRoute(partialRouteId)

  if (partialRouteId.endsWith('/_layout')) {
    const parentId = partialRouteId.slice(0, -'/_layout'.length)
    const parentPath = createRoutePath(parentId)
    if (!parentPath) {
      return '_layout'
    }
    return `${parentPath}/_layout`
  }

  const { path } = getRouteSegments(
    partialRouteId,
    isIndexRouteId(partialRouteId),
  )
  if (!path) {
    return path
  }

  if (
    /^\(__[^)]+\)\//.test(partialRouteId) &&
    path.startsWith('__') &&
    path.includes('?/')
  ) {
    const segments = path.split('/')
    const [first, ...rest] = segments
    if (first?.startsWith('__') && first.endsWith('?')) {
      const remainder = rest.join('/')
      return remainder ? `(${remainder}` : '('
    }
  }

  return path
}

function isIndexRouteId(routeId: string): boolean {
  return (
    routeId === 'index' ||
    routeId.endsWith('/index') ||
    routeId.endsWith(DOT_INDEX_SUFFIX) ||
    routeId.endsWith(DOT_UNDERSCORE_INDEX_SUFFIX)
  )
}

function validatePartialRoute(partialRouteId: string): void {
  if (/\(\$\)(?:$|[/.])/.test(partialRouteId)) {
    throw new Error(
      `Invalid route path: ${partialRouteId}. Splat route $ is already optional`,
    )
  }

  if (/(^|[/.])\(index\)(?:$|[/.])/.test(partialRouteId)) {
    throw new Error(
      `Invalid route path: ${partialRouteId}. Make index route optional by using (index)`,
    )
  }
}
