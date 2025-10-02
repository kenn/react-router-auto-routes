import * as path from 'path'
import { RouteInfo, autoRoutesOptions } from './types'
import { createRouteId, validateRouteDir } from '../utils'
import { isIndexRoute } from './route-detection'
import { createRoutePath, getRouteSegments } from './route-path'

export function getRouteInfo(
  routeDir: string,
  file: string,
  options: autoRoutesOptions,
): RouteInfo {
  validateRouteDir(routeDir)

  let filePath = path.join(routeDir, file).split(path.win32.sep).join('/')
  let routeId = createRouteId(filePath)
  let routeIdWithoutRoutes = routeId.slice(routeDir.length + 1)
  let index = isIndexRoute(routeIdWithoutRoutes, options)
  let routeSegments = getRouteSegments(
    routeIdWithoutRoutes,
    index,
    options.paramChar,
    options.colocateChar,
  )
  let routePath = createRoutePath(routeSegments, index, options)
  let routeInfo = {
    id: routeId,
    path: routePath!,
    file: filePath,
    name: routeSegments.join('/'),
    segments: routeSegments,
    index,
  }

  return routeInfo
}

function isLayoutRoute(route: RouteInfo): boolean {
  const fileName = route.file.split('/').pop() ?? ''
  const withoutExtension = fileName.replace(/\.[^/.]+$/, '')
  const normalized = withoutExtension.endsWith('.route')
    ? withoutExtension.slice(0, -'.route'.length)
    : withoutExtension

  return normalized === '_layout' || normalized === 'layout'
}

function findBestParent(
  child: RouteInfo,
  candidates: RouteInfo[],
): RouteInfo | undefined {
  // Filter out invalid candidates (self and index routes)
  const eligible = candidates.filter(
    (candidate) => candidate.id !== child.id && !candidate.index,
  )

  if (eligible.length === 0) {
    return undefined
  }

  // Prefer regular routes (score 3) over layout routes (score 2)
  // Higher score = better parent
  let best = eligible[0]
  let bestScore = isLayoutRoute(best) ? 2 : 3

  for (let i = 1; i < eligible.length; i++) {
    const candidate = eligible[i]
    const score = isLayoutRoute(candidate) ? 2 : 3
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
  // Index routes should look for a parent with their full path first,
  // because they might have a layout with the same segments
  // e.g., home/index.tsx (segments: ['home']) should be child of home/_layout.tsx (segments: ['home'])
  let parentName = routeInfo.index
    ? routeInfo.segments.join('/')
    : routeInfo.segments.slice(0, -1).join('/')

  // Walk up the path hierarchy looking for a parent
  while (parentName) {
    const candidates = nameMap.get(parentName)
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
