const ESCAPE_START = '['
const ESCAPE_END = ']'
const OPTIONAL_START = '('
const OPTIONAL_END = ')'

// Trailing `route` markers never contribute a URL segment.
const STRIP_ALWAYS = new Set(['route', '_route'])
// Trailing special files are stripped when deriving nesting segments.
const SPECIAL_ROUTE_FILES = new Set([
  ...STRIP_ALWAYS,
  'index',
  '_index',
  '_layout',
])

type State = 'NORMAL' | 'ESCAPE' | 'OPTIONAL' | 'OPTIONAL_ESCAPE'

function isSegmentSeparator(char: string | undefined): boolean {
  return char === '/' || char === '.' || char === '\\'
}

function pushRouteSegment(
  routeSegments: string[],
  rawRouteSegments: string[],
  segment: string,
  rawSegment: string,
  routeId: string,
): void {
  if (!segment) return

  const invalid: Array<[string, string]> = [
    [rawSegment, '*'],
    [rawSegment, ':'],
    [segment, '/'],
  ]
  for (const [value, char] of invalid) {
    if (value.includes(char)) {
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

  while (STRIP_ALWAYS.has(rawRouteSegments[rawRouteSegments.length - 1])) {
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
  const segments = deriveNameSegments(rawRouteSegments)

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

function deriveNameSegments(rawSegments: readonly string[]): string[] {
  const segments = [...rawSegments]
  while (SPECIAL_ROUTE_FILES.has(segments[segments.length - 1])) {
    segments.pop()
  }
  return segments
}
