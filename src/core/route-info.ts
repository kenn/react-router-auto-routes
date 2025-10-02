import * as path from 'path'
import { RouteInfo, autoRoutesOptions } from './types'
import { createRouteId, validateRouteDir, normalizeSlashes } from '../utils'
import { isIndexRoute } from './route-detection'
import { createRoutePath, getRouteSegments } from './route-path'

export function getRouteInfo(
  routeDir: string,
  file: string,
  options: autoRoutesOptions,
): RouteInfo {
  validateRouteDir(routeDir)

  let filePath = normalizeSlashes(path.join(routeDir, file))
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

export function findParentRouteId(
  routeInfo: RouteInfo,
  nameMap: Map<string, RouteInfo[]>,
): string | undefined {
  let parentName = routeInfo.segments.slice(0, -1).join('/')

  while (parentName) {
    const candidates = nameMap.get(parentName)
    if (candidates && candidates.length > 0) {
      const parent = selectParentCandidate(routeInfo, candidates)
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

function selectParentCandidate(
  child: RouteInfo,
  candidates: RouteInfo[],
): RouteInfo | undefined {
  const eligibleParents = candidates.filter(
    (candidate) => candidate.id !== child.id && !candidate.index,
  )

  if (eligibleParents.length === 0) {
    return undefined
  }

  let best: RouteInfo | undefined
  let bestScore = Number.NEGATIVE_INFINITY

  for (const candidate of eligibleParents) {
    const candidateScore = getParentPriority(candidate)
    if (candidateScore > bestScore) {
      best = candidate
      bestScore = candidateScore
    }
  }

  return best
}

function getParentPriority(route: RouteInfo): number {
  if (isLayoutRoute(route)) {
    return 2
  }

  return 3
}

function isLayoutRoute(route: RouteInfo): boolean {
  const fileName = route.file.split('/').pop() ?? ''
  const withoutExtension = fileName.replace(/\.[^/.]+$/, '')
  const normalized = withoutExtension.endsWith('.route')
    ? withoutExtension.slice(0, -'.route'.length)
    : withoutExtension

  return normalized === '_layout' || normalized === 'layout'
}
