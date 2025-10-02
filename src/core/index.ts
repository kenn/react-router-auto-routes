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
    /((\${colocateChar}[\/\\][^\/\\:?*]+)|[\/\\]((index|route|layout|page)|(_[^\/\\:?*]+)|([^\/\\:?*]+\.route)|([^\/\\:?*]+)))\.(ts|tsx|js|jsx|md|mdx)$/,
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
  const nameMap: Map<string, RouteInfo[]> = new Map()
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

      if (!nameMap.has(routeInfo.name)) {
        nameMap.set(routeInfo.name, [routeInfo])
      } else {
        nameMap.get(routeInfo.name)!.push(routeInfo)
      }
    })
  }

  // Normalize nested folder routes without parents to use dot notation
  // This makes oauth/google.ts behave like oauth.google.ts (no parent required)
  for (const routeInfo of routeMap.values()) {
    // Skip if route is flat, an index route, or uses special syntax
    if (routeInfo.segments.length <= 1 || routeInfo.index) {
      continue
    }

    // Check if route uses folder nesting (not already using dot notation)
    const fileRelativeToRouteDir = routeInfo.id.replace(/^routes\//, '')
    const pathParts = fileRelativeToRouteDir.split('/')

    // Skip if any part uses dot notation or special syntax
    let usesSpecialSyntax = false
    for (const part of pathParts) {
      const nameToCheck = part.replace(/\.(ts|tsx|js|jsx|md|mdx)$/, '')
      if (nameToCheck.includes('.') || nameToCheck.includes('(') || nameToCheck.includes(')')) {
        usesSpecialSyntax = true
        break
      }
    }

    if (usesSpecialSyntax) {
      continue
    }

    // Check if parent exists
    const parentSegments = routeInfo.segments.slice(0, -1)
    const parentName = parentSegments.join('/')
    const existingParents = nameMap.get(parentName)
    const hasNonIndexParent = existingParents?.some(p => !p.index)

    // If no parent exists, flatten this route to root level
    // by treating folder separator as dot notation
    if (!hasNonIndexParent) {
      // Update the name to use dot notation (all segments joined with /)
      routeInfo.name = routeInfo.segments.join('/')

      // Keep the segments as-is (they determine the path)
      // The route will be at root level but with the full path
    }
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

  // Index routes nested under a non-root parent should not have a path
  // when the relative path is empty (meaning they match the parent's path exactly)
  if (route.index && route.parentId && route.parentId !== 'root' && !relative) {
    return undefined
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
