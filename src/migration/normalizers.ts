import path from 'node:path'

function cleanLegacySegment(segment: string, dropTrailingPlus = true): string {
  const withoutPlus = dropTrailingPlus ? segment.replace(/\+$/g, '') : segment
  return withoutPlus.replace(
    /(^|\.|_)__+/g,
    (_match: string, prefix: string) => `${prefix}_`,
  )
}

export function convertToRoute(
  sourceDir: string,
  id: string,
  hasChildren: boolean,
) {
  const routeId = id.substring(sourceDir.length + 1)
  const segments = routeId.split('/')
  const normalizedSegments = segments.map((segment, index) =>
    cleanLegacySegment(segment, index < segments.length - 1),
  )
  const flat = normalizedSegments.join('/')
  return hasChildren ? `${flat}/_layout` : flat
}

const UNESCAPABLE_SEGMENTS = new Set([
  '$',
  'index',
  '_index',
  '_layout',
  'route',
  '_route',
])

/**
 * Adds the trailing-underscore escape to the route segment at `segmentIndex`
 * of a migrated route name, e.g. `settings/profile.two-factor` with index 1
 * becomes `settings/profile_.two-factor`. The escaped segment keeps its URL
 * but no longer matches a layout with the plain segment, so `autoRoutes`
 * stops nesting the route under that layout. Segments are counted the way
 * `getRouteSegments` splits them (`/` and `.`, outside `[...]` and `(...)`).
 * Returns `undefined` when the segment is missing, last, or cannot be escaped.
 */
export function escapeRouteSegment(
  name: string,
  segmentIndex: number,
): string | undefined {
  let count = 0
  let start = 0
  // Mirrors the states in `getRouteSegments`: separators split only outside
  // `[...]` escapes and `(...)` optional segments.
  let inEscape = false
  let inOptional = false

  for (let index = 0; index <= name.length; index++) {
    const char = name[index]
    const atEnd = index === name.length
    if (!atEnd) {
      if (inEscape) {
        if (char === ']') inEscape = false
        continue
      }
      if (char === '[') {
        inEscape = true
        continue
      }
      if (inOptional) {
        if (char === ')') inOptional = false
        continue
      }
      if (char === '(') {
        inOptional = true
        continue
      }
      if (char !== '/' && char !== '.') {
        continue
      }
    }

    const segment = name.slice(start, index)
    start = index + 1
    if (!segment || count++ !== segmentIndex) {
      continue
    }

    if (atEnd || segment.endsWith('_') || UNESCAPABLE_SEGMENTS.has(segment)) {
      return undefined
    }
    return `${name.slice(0, index)}_${name.slice(index)}`
  }

  return undefined
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

  // A trailing `_` before `.` or `/` only escapes nesting (see
  // `escapeRouteSegment`); `profile_.two-factor` names `profile.two-factor`.
  return result.join('/').replace(/([^/._])_(?=[/.])/g, '$1') + ext
}
