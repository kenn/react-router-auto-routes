import path from 'path'

import { SPECIAL_ROUTE_FILES } from '../constants'

const ESCAPE_START = '['
const ESCAPE_END = ']'
const OPTIONAL_START = '('
const OPTIONAL_END = ')'
const WINDOWS_SEPARATOR = path.win32.sep

const STRIP_ALWAYS = new Set(['route', '_route'])

type State = 'NORMAL' | 'ESCAPE' | 'OPTIONAL' | 'OPTIONAL_ESCAPE'

function isSegmentSeparator(char: string | undefined): boolean {
  if (!char) return false
  return char === '/' || char === '.' || char === WINDOWS_SEPARATOR
}

function pushRouteSegment(
  routeSegments: string[],
  rawRouteSegments: string[],
  segment: string,
  rawSegment: string,
  routeId: string,
): void {
  if (!segment) return

  const checks: Array<[string, string, string]> = [
    [rawSegment, '*', rawSegment],
    [rawSegment, ':', rawSegment],
    [rawSegment, '/', segment],
  ]
  for (const [testValue, char, value] of checks) {
    if (testValue.includes(char)) {
      throw new Error(
        `Route segment "${value}" for "${routeId}" cannot contain "${char}".\n` +
          `If this is something you need, upvote this proposal for React Router https://github.com/remix-run/react-router/discussions/9822.`,
      )
    }
  }

  routeSegments.push(segment)
  rawRouteSegments.push(rawSegment)
}

function stripTrailingSpecialSegments(
  originalName: string,
  routeSegments: string[],
  rawRouteSegments: string[],
): void {
  if (!originalName.includes('/')) {
    return
  }

  while (routeSegments.length > 0 && rawRouteSegments.length > 0) {
    const lastRaw = rawRouteSegments[rawRouteSegments.length - 1]
    if (!lastRaw || !STRIP_ALWAYS.has(lastRaw)) {
      break
    }

    routeSegments.pop()
    rawRouteSegments.pop()
  }
}

export function getRouteSegments(
  routeId: string,
  isIndex: boolean,
  paramChar: string = '$',
): { segments: string[]; path: string | undefined } {
  const routeSegments: string[] = []
  const rawRouteSegments: string[] = []

  let routeSegment = ''
  let rawRouteSegment = ''
  let state: State = 'NORMAL'

  const flushSegment = () => {
    pushRouteSegment(
      routeSegments,
      rawRouteSegments,
      routeSegment,
      rawRouteSegment,
      routeId,
    )
    routeSegment = ''
    rawRouteSegment = ''
  }

  for (let index = 0; index < routeId.length; index++) {
    const char = routeId[index]
    if (state === 'ESCAPE' || state === 'OPTIONAL_ESCAPE') {
      if (char === ESCAPE_END) {
        state = state === 'ESCAPE' ? 'NORMAL' : 'OPTIONAL'
        rawRouteSegment += char
      } else {
        routeSegment += char
        rawRouteSegment += char
      }
      continue
    }

    if (state === 'NORMAL') {
      if (isSegmentSeparator(char)) {
        flushSegment()
        continue
      }
      if (char === ESCAPE_START) {
        state = 'ESCAPE'
        rawRouteSegment += char
        continue
      }
      if (char === OPTIONAL_START) {
        state = 'OPTIONAL'
        rawRouteSegment += char
        continue
      }
    }

    if (state === 'OPTIONAL') {
      if (char === OPTIONAL_END) {
        routeSegment += '?'
        rawRouteSegment += char
        state = 'NORMAL'
        continue
      }
      if (char === ESCAPE_START) {
        state = 'OPTIONAL_ESCAPE'
        rawRouteSegment += char
        continue
      }
    }

    if (
      !routeSegment &&
      char === paramChar &&
      (state === 'NORMAL' || state === 'OPTIONAL')
    ) {
      const next = routeId[index + 1]
      routeSegment +=
        index + 1 === routeId.length || isSegmentSeparator(next) ? '*' : ':'
      rawRouteSegment += char
      continue
    }

    routeSegment += char
    rawRouteSegment += char
  }

  flushSegment()

  stripTrailingSpecialSegments(routeId, routeSegments, rawRouteSegments)

  const path = createRoutePath(routeSegments, rawRouteSegments, isIndex)
  const segments = deriveNameSegments(routeId, rawRouteSegments)

  return { segments, path }
}

function createRoutePath(
  routeSegments: string[],
  rawRouteSegments: string[],
  isIndex: boolean,
): string | undefined {
  const length = isIndex ? routeSegments.length - 1 : routeSegments.length
  if (length <= 0) {
    return undefined
  }

  const parts: string[] = []

  for (let i = 0; i < length; i++) {
    let segment = routeSegments[i]
    const rawSegment = rawRouteSegments[i]

    if (!rawSegment) {
      continue
    }

    if (segment.startsWith('_') && rawSegment.startsWith('_')) {
      continue
    }

    if (segment.endsWith('_') && rawSegment.endsWith('_')) {
      segment = segment.slice(0, -1)
    }

    parts.push(segment)
  }

  return parts.length > 0 ? parts.join('/') : undefined
}

function deriveNameSegments(
  routeId: string,
  rawSegments: readonly string[],
): string[] {
  if (!routeId.includes('/')) {
    return [...rawSegments]
  }

  const segments = [...rawSegments]

  while (segments.length > 0) {
    const last = segments[segments.length - 1]
    if (!last || !SPECIAL_ROUTE_FILES.includes(last)) {
      break
    }
    segments.pop()
  }

  return segments
}
