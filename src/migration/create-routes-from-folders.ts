import { getRouteSegments } from '../core/routing/segments'
import { DOT_INDEX_SUFFIX } from './constants'
import {
  DefineRouteFunction,
  DefineRoutesFunction,
  RouteManifest,
} from './route-definition'
import { scanRouteModules } from './route-scanner'

export type CreateRoutesFromFoldersOptions = {
  /**
   * The directory where your app lives. Defaults to `app`.
   * @default "app"
   */
  appDirectory?: string
  /**
   * A list of glob patterns to ignore when looking for route modules.
   * Defaults to `[]`.
   */
  ignoredFilePatterns?: string[]
  /**
   * The directory where your routes live. Defaults to `routes`.
   * This is relative to `appDirectory`.
   * @default "routes"
   */
  routesDirectory?: string
}

/**
 * Defines routes using the filesystem convention in `app/routes`. The rules are:
 *
 * - Route paths are derived from the file path. A `.` in the filename indicates
 *   a `/` in the URL (a "nested" URL, but no route nesting). A `$` in the
 *   filename indicates a dynamic URL segment.
 * - Subdirectories are used for nested routes.
 *
 * For example, a file named `app/routes/gists/$username.tsx` creates a route
 * with a path of `gists/:username`.
 */
export function createRoutesFromFolders(
  defineRoutes: DefineRoutesFunction,
  options: CreateRoutesFromFoldersOptions = {},
): RouteManifest {
  let {
    appDirectory = 'app',
    ignoredFilePatterns = [],
    routesDirectory = 'routes',
  } = options

  const files = scanRouteModules({
    appDirectory,
    routesDirectory,
    ignoredFilePatterns,
  })

  let routeIds = Object.keys(files).sort(byLongestFirst)
  let parentRouteIds = getParentRouteIds(routeIds)
  let seenRoutes = new Map<string, string>()

  // Then, recurse through all routes using the public defineRoutes() API
  function defineNestedRoutes(
    defineRoute: DefineRouteFunction,
    parentId?: string,
  ): void {
    let childRouteIds = routeIds.filter((id) => {
      return parentRouteIds[id] === parentId
    })

    for (let routeId of childRouteIds) {
      let routePath: string | undefined = createRoutePath(
        routeId.slice((parentId || routesDirectory).length + 1),
      )

      let isIndexRoute = isIndexRouteId(routeId)
      let fullPath = createRoutePath(routeId.slice(routesDirectory.length + 1))
      let uniqueRouteId = (fullPath || '') + (isIndexRoute ? '?index' : '')
      let isPathlessLayoutRoute =
        routeId.split('/').pop()?.startsWith('__') === true

      ensureUniqueRoute(seenRoutes, {
        id: routeId,
        fullPath: fullPath || '/',
        uniqueKey: uniqueRouteId,
        isPathlessLayoutRoute,
      })

      if (isIndexRoute) {
        let invalidChildRoutes = routeIds.filter(
          (id) => parentRouteIds[id] === routeId,
        )

        if (invalidChildRoutes.length > 0) {
          throw new Error(
            `Child routes are not allowed in index routes. Please remove child routes of ${routeId}`,
          )
        }

        defineRoute(routePath, files[routeId], { index: true, id: routeId })
      } else {
        defineRoute(routePath, files[routeId], { id: routeId }, () => {
          defineNestedRoutes(defineRoute, routeId)
        })
      }
    }
  }

  return defineRoutes(defineNestedRoutes)
}

export { createRoutePath }

function getParentRouteIds(
  routeIds: string[],
): Record<string, string | undefined> {
  // We could use Array objects directly below, but Map is more performant,
  // especially for larger arrays of routeIds,
  // due to the faster lookups provided by the Map data structure.
  const routeIdMap = new Map<string, string>()
  for (const routeId of routeIds) {
    routeIdMap.set(routeId, routeId)
  }

  const parentRouteIdMap = new Map<string, string | undefined>()
  for (const [childRouteId, _] of routeIdMap) {
    let parentRouteId: string | undefined = undefined
    for (const [potentialParentId, _] of routeIdMap) {
      if (childRouteId.startsWith(`${potentialParentId}/`)) {
        parentRouteId = potentialParentId
        break
      }
    }

    if (!parentRouteId && childRouteId.endsWith(DOT_INDEX_SUFFIX)) {
      const dotNotationParentId = childRouteId.slice(
        0,
        -DOT_INDEX_SUFFIX.length,
      )
      if (routeIdMap.has(dotNotationParentId)) {
        parentRouteId = dotNotationParentId
      }
    }

    parentRouteIdMap.set(childRouteId, parentRouteId)
  }

  return Object.fromEntries(parentRouteIdMap)
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
    routeId.endsWith(DOT_INDEX_SUFFIX)
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
