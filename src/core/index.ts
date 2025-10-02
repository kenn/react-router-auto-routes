import picomatch from 'picomatch'
import * as path from 'path'

import {
  RouteInfo,
  RouteConfig,
  VisitFilesFunction,
  autoRoutesOptions,
} from './types'
import { defaultVisitFiles } from '../utils'
import { isRouteModuleFile, getRouteRegex } from './route-detection'
import { getRouteInfo, findParentRouteId } from './route-info'

export { autoRoutes }
export type { RouteConfig, autoRoutesOptions } from './types'

const defaultOptions: autoRoutesOptions = {
  appDir: 'app',
  routeDir: 'routes',
  basePath: '/',
  paramChar: '$',
  colocateChar: '+',
  routeRegex:
    /((\${colocateChar}[\/\\][^\/\\:?*]+)|[\/\\]((index|route|layout|page)|(_[^\/\\:?*]+)|([^\/\\:?*]+\.route)))\.(ts|tsx|js|jsx|md|mdx)$/,
}

export default function autoRoutes(
  options: autoRoutesOptions = {},
): RouteConfig[] {
  const {
    appDir = defaultOptions.appDir!,
    ignoredRouteFiles = [],
    colocateChar: userColocateChar,
    routeRegex: userRouteRegex,
    routeDir = defaultOptions.routeDir!,
    visitFiles: userVisitFiles,
    ...rest
  } = options

  const resolvedOptions: autoRoutesOptions = {
    ...defaultOptions,
    ...rest,
    appDir,
    ignoredRouteFiles,
    routeDir,
  }

  if (userColocateChar !== undefined) {
    resolvedOptions.colocateChar = userColocateChar
  }

  const visitFiles: VisitFilesFunction =
    userVisitFiles ?? resolvedOptions.visitFiles ?? defaultVisitFiles
  const colocateChar =
    resolvedOptions.colocateChar ?? defaultOptions.colocateChar!
  const routeRegex = getRouteRegex(
    userRouteRegex ?? resolvedOptions.routeRegex ?? defaultOptions.routeRegex!,
    colocateChar,
  )

  const routeMap: Map<string, RouteInfo> = new Map()
  const nameMap: Map<string, RouteInfo> = new Map()
  const routeDirs = Array.isArray(routeDir) ? routeDir : [routeDir]

  for (const currentRouteDir of routeDirs) {
    const directory = path.join(appDir, currentRouteDir)
    visitFiles(directory, (file) => {
      if (
        ignoredRouteFiles &&
        ignoredRouteFiles.some((pattern) =>
          picomatch.isMatch(file, pattern, { dot: true }),
        )
      ) {
        return
      }

      const isRoute = isRouteModuleFile(
        file,
        colocateChar,
        routeRegex,
      )

      if (!isRoute) {
        return
      }

      const routeInfo = getRouteInfo(currentRouteDir, file, {
        ...resolvedOptions,
        visitFiles,
        routeRegex,
        colocateChar,
      })

      routeMap.set(routeInfo.id, routeInfo)
      nameMap.set(routeInfo.name, routeInfo)
    })
  }

  const orderedRouteInfos = Array.from(routeMap.values())

  for (const routeInfo of orderedRouteInfos) {
    const parentId = findParentRouteId(routeInfo, nameMap)
    routeInfo.parentId = parentId
  }

  for (const routeInfo of orderedRouteInfos) {
    if (routeInfo.parentId === undefined) {
      routeInfo.parentId = 'root'
    }
  }

  return buildRouteTree(orderedRouteInfos, {
    routeMap,
  })
}

function buildRouteTree(
  routes: RouteInfo[],
  context: { routeMap: Map<string, RouteInfo> },
): RouteConfig[] {
  const childrenByParent = new Map<string, RouteInfo[]>()

  for (const route of routes) {
    const parentKey = route.parentId ?? 'root'
    if (!childrenByParent.has(parentKey)) {
      childrenByParent.set(parentKey, [])
    }
    childrenByParent.get(parentKey)!.push(route)
  }

  const createRouteConfig = (route: RouteInfo): RouteConfig => {
    const node: RouteConfig = {
      id: route.id,
      file: route.file,
    }

    if (route.caseSensitive) {
      node.caseSensitive = true
    }

    const relativePath = computeRelativePath(route, context)
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
      node.children = children.map(createRouteConfig)
    }

    return node
  }

  const topLevelRoutes = childrenByParent.get('root') ?? []
  return topLevelRoutes.map(createRouteConfig)
}

function computeRelativePath(
  route: RouteInfo,
  context: { routeMap: Map<string, RouteInfo> },
): string | undefined {
  if (!route.path) {
    return undefined
  }

  const parentId = route.parentId
  const parentPath = getParentPath(parentId, context)

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

  return relative || undefined
}

function getParentPath(
  parentId: string | undefined,
  context: { routeMap: Map<string, RouteInfo> },
): string {
  if (!parentId || parentId === 'root') {
    return '/'
  }

  const parentRoute = context.routeMap.get(parentId)
  if (!parentRoute?.path) {
    return '/'
  }

  return parentRoute.path
}
