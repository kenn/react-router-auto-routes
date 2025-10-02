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
import { createRoutePath } from './route-path'

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

  // Create synthetic parent routes for nested folder routes without explicit parents
  // This allows api/users.ts and api/posts.ts to work without requiring api.tsx
  const syntheticParents = new Set<string>()

  for (const routeInfo of routeMap.values()) {
    // Only create synthetic parents for true folder-based nesting
    // Skip if:
    // 1. Route is flat (no segments or only 1 segment)
    // 2. Route uses dot notation (folder names or filenames contain dots)
    // 3. Route is an index route (they handle their own nesting)

    if (routeInfo.segments.length <= 1 || routeInfo.index) {
      continue
    }

    // Check if this route uses dot notation by examining the original file path
    // Extract the path without "routes/" prefix and without the file extension
    const fileRelativeToRouteDir = routeInfo.id.replace(/^routes\//, '')
    const pathParts = fileRelativeToRouteDir.split('/')

    // If ANY part of the path (folder or filename) contains special characters,
    // skip synthetic parent creation as these indicate special routing syntax
    let usesSpecialSyntax = false
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i]
      // For the last part (filename), remove extension first
      const nameToCheck = i === pathParts.length - 1
        ? part.replace(/\.(ts|tsx|js|jsx|md|mdx)$/, '')
        : part

      // Skip if uses dot notation or parentheses (optional segments)
      if (nameToCheck.includes('.') || nameToCheck.includes('(') || nameToCheck.includes(')')) {
        usesSpecialSyntax = true
        break
      }
    }

    if (usesSpecialSyntax) {
      continue
    }

    // Check each parent level to see if it needs a synthetic parent
    for (let i = routeInfo.segments.length - 1; i > 0; i--) {
      const parentSegments = routeInfo.segments.slice(0, i)
      const parentName = parentSegments.join('/')

      // Skip if we already created this synthetic parent
      if (syntheticParents.has(parentName)) {
        continue
      }

      // Check if a real parent exists
      const existingParents = nameMap.get(parentName)
      const hasNonIndexParent = existingParents?.some(p => !p.index)

      if (!hasNonIndexParent) {
        // Create synthetic parent route
        const syntheticId = `routes/${parentName}`
        const syntheticPath = createRoutePath(parentSegments, false, {
          ...resolvedOptions,
          visitFiles,
          routeRegex,
          colocateChar,
        })

        const syntheticRoute: RouteInfo = {
          id: syntheticId,
          path: syntheticPath!,
          file: '', // No physical file
          name: parentName,
          segments: parentSegments,
          index: false,
          synthetic: true,
        }

        routeMap.set(syntheticId, syntheticRoute)

        if (!nameMap.has(parentName)) {
          nameMap.set(parentName, [syntheticRoute])
        } else {
          nameMap.get(parentName)!.push(syntheticRoute)
        }

        syntheticParents.add(parentName)
      }
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
    }

    // Only include file property if route is not synthetic
    if (!route.synthetic) {
      node.file = route.file
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
