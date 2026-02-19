import path from 'node:path'

import type { RouteManifest } from './route-definition'

function cleanLegacySegment(segment: string, dropTrailingPlus = true): string {
  const withoutPlus = dropTrailingPlus ? segment.replace(/\+$/g, '') : segment
  return withoutPlus.replace(
    /(^|\.|_)__+/g,
    (_match: string, prefix: string) => `${prefix}_`,
  )
}

export function convertToRoute(
  routes: RouteManifest,
  sourceDir: string,
  id: string,
  parentId: string,
) {
  let routeId = id.substring(sourceDir.length + 1)
  parentId =
    parentId === 'root' ? parentId : parentId.substring(sourceDir.length + 1)

  const segments = routeId.split('/')
  const normalizedSegments = segments.map((segment, index) =>
    cleanLegacySegment(segment, index < segments.length - 1),
  )
  let flat = normalizedSegments.join('/')

  if (Object.values(routes).some((route) => route.parentId === id)) {
    flat = flat + '/_layout'
  }

  return flat
}

export function convertColocatedPath(file: string): string {
  const normalized = file.replace(/\\/g, '/')
  const segments = normalized.split('/')

  let colocatedFolderIndex = -1
  for (let index = 0; index < segments.length - 1; index++) {
    const segment = segments[index]
    if (
      segment &&
      !segment.endsWith('+') &&
      segment !== '.' &&
      segment !== ''
    ) {
      colocatedFolderIndex = index
      break
    }
  }

  const converted = segments.map((segment, index) => {
    const isLastSegment = index === segments.length - 1

    if (index === colocatedFolderIndex) {
      return '+' + segment
    }

    if (!isLastSegment) {
      return segment.replace(/\+$/, '')
    }

    return segment
  })

  return converted.join(path.sep)
}

export function normalizeSnapshotRouteFilePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const ext = path.extname(normalized)
  const base = ext ? normalized.slice(0, -ext.length) : normalized
  const rawSegments = base.split('/')

  const result: string[] = []

  for (const rawSegment of rawSegments) {
    const segment = cleanLegacySegment(rawSegment)

    if (!segment) {
      result.push(segment)
      continue
    }

    if (segment === '_layout' && result.length > 0) {
      continue
    }

    // Treat folder route convention (`about/route.tsx`) the same as flat file
    // (`about.tsx`). The `route` segment is a marker, not a path component.
    if (segment === 'route' && result.length > 0) {
      continue
    }

    if (segment === 'index' && result.length > 0) {
      const parent = result.pop()!
      result.push(`${parent}.index`)
      continue
    }

    if (
      result.length > 0 &&
      result[result.length - 1].endsWith('_') &&
      segment.startsWith('_')
    ) {
      const previous = result.pop()!
      const suffix = segment.slice(1)
      const combined = suffix.length > 0 ? `${previous}.${suffix}` : previous
      result.push(combined)
      continue
    }

    result.push(segment)
  }

  return result.join('/') + ext
}
