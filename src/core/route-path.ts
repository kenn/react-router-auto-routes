import * as path from 'path'
import { autoRoutesOptions } from './types'
import { SPECIAL_ROUTE_FILES, PATHLESS_PREFIX } from './constants'

const pathSeparatorRegex = /[\/\\.]/

function isPathSeparator(char: string) {
  return pathSeparatorRegex.test(char)
}

function removeSquareBrackets(segment: string): string {
  if (!segment.includes('[') || !segment.includes(']')) {
    return segment
  }

  let output = ''
  let depth = 0

  for (const char of segment) {
    if (char === '[' && depth === 0) {
      depth++
    } else if (char === ']' && depth > 0) {
      depth--
    } else {
      output += char
    }
  }

  return output
}

function transformSegment(segment: string, paramChar: string, index: boolean): string | null {
  // Skip pathless layout segments
  if (segment.startsWith(PATHLESS_PREFIX)) {
    return null
  }

  // Remove trailing slash marker
  if (segment.endsWith(PATHLESS_PREFIX)) {
    segment = segment.slice(0, -1)
  }

  // Remove outer square brackets (escape characters)
  segment = removeSquareBrackets(segment)

  // Skip explicit index segments for index routes
  if (index && segment === 'index') {
    return null
  }

  // Handle param segments: $ => *, $id => :id
  if (segment.startsWith(paramChar)) {
    return segment === paramChar ? '/*' : `/:${segment.slice(1)}`
  }

  // Handle optional segments with param: ($segment) => :segment?
  if (segment.startsWith(`(${paramChar}`)) {
    return `/:${segment.slice(2, segment.length - 1)}?`
  }

  // Handle optional segments: (segment) => segment?
  if (segment.startsWith('(')) {
    return `/${segment.slice(1, segment.length - 1)}?`
  }

  // Regular segment
  return `/${segment}`
}

// create full path starting with /
export function createRoutePath(
  routeSegments: string[],
  index: boolean,
  options: autoRoutesOptions,
): string | undefined {
  const basePath = options.basePath ?? '/'
  const paramChar = options.paramChar ?? '$'

  const pathParts = routeSegments
    .map((segment) => transformSegment(segment, paramChar, index))
    .filter((part): part is string => part !== null)

  let result = pathParts.join('')

  if (basePath !== '/') {
    result = basePath + result
  }

  if (result.endsWith('/')) {
    result = result.slice(0, -1)
  }

  return result || undefined
}

function removeSpecialRouteFile(name: string): string {
  const hasFolder = name.includes('/')
  if (!hasFolder) {
    return name
  }

  const lastSegment = name.split('/').pop()
  if (!lastSegment || !SPECIAL_ROUTE_FILES.includes(lastSegment)) {
    return name
  }

  const lastSlash = name.lastIndexOf('/')
  return lastSlash >= 0 ? name.substring(0, lastSlash) : name
}

function validateSegment(segment: string, paramChar: string): void {
  if (
    segment.includes(paramChar) &&
    !(segment.startsWith(paramChar) || segment.startsWith(`(${paramChar}`))
  ) {
    throw new Error(
      `Route params must start with prefix char ${paramChar}: ${segment}`,
    )
  }

  if (
    segment.includes('(') &&
    !segment.startsWith('(') &&
    !segment.endsWith(')')
  ) {
    throw new Error(
      `Optional routes must start and end with parentheses: ${segment}`,
    )
  }
}

function parseSegmentsFromPath(name: string): string[] {
  const segments: string[] = []
  let currentSegment = ''
  let inEscape = false

  for (const char of name) {
    if (char === '[') {
      inEscape = true
      currentSegment += char
    } else if (char === ']') {
      inEscape = false
      currentSegment += char
    } else if (isPathSeparator(char) && !inEscape) {
      if (currentSegment) {
        segments.push(currentSegment)
        currentSegment = ''
      }
    } else {
      currentSegment += char
    }
  }

  if (currentSegment) {
    segments.push(currentSegment)
  }

  return segments
}

export function getRouteSegments(
  name: string,
  _index: boolean,
  paramChar: string = '$',
  colocateChar: string = '+',
): string[] {
  // Remove special route files like index, layout, route, page
  const cleanedName = removeSpecialRouteFile(name)

  // Parse segments from the path
  const segments = parseSegmentsFromPath(cleanedName)

  // Validate each segment
  for (const segment of segments) {
    validateSegment(segment, paramChar)
  }

  // Strip trailing .route segment if present
  if (segments.at(-1) === 'route') {
    segments.pop()
  }

  return segments
}
