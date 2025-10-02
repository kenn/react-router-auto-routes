import * as path from 'path'
import { autoRoutesOptions } from './types'

const pathSeparatorRegex = /[\/\\.]/

function isPathSeparator(char: string) {
  return pathSeparatorRegex.test(char)
}

// create full path starting with /
export function createRoutePath(
  routeSegments: string[],
  index: boolean,
  options: autoRoutesOptions,
): string | undefined {
  let result = ''
  let basePath = options.basePath ?? '/'
  let paramChar = options.paramChar ?? '$'

  // Make a copy to avoid mutating the original
  let segments = [...routeSegments]

  // For index routes, the segments already represent the correct path
  // since we removed "index" during segment generation
  // No need to modify them further

  for (let i = 0; i < segments.length; i++) {
    let segment = segments[i]
    // skip pathless layout segments
    if (segment.startsWith('_')) {
      continue
    }
    // remove trailing slash marker
    if (segment.endsWith('_')) {
      segment = segment.slice(0, -1)
    }

    // remove outer square brackets
    if (segment.includes('[') && segment.includes(']')) {
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

      segment = output
    }

    // skip explicit index segments for index routes
    if (index && segment === 'index') {
      continue
    }

    // handle param segments: $ => *, $id => :id
    if (segment.startsWith(paramChar)) {
      if (segment === paramChar) {
        result += `/*`
      } else {
        result += `/:${segment.slice(1)}`
      }
      // handle optional segments with param: ($segment) => :segment?
    } else if (segment.startsWith(`(${paramChar}`)) {
      result += `/:${segment.slice(2, segment.length - 1)}?`
      // handle optional segments: (segment) => segment?
    } else if (segment.startsWith('(')) {
      result += `/${segment.slice(1, segment.length - 1)}?`
    } else {
      result += `/${segment}`
    }
  }
  if (basePath !== '/') {
    result = basePath + result
  }

  if (result.endsWith('/')) {
    result = result.slice(0, -1)
  }

  return result || undefined
}

export function getRouteSegments(
  name: string,
  _index: boolean,
  paramChar: string = '$',
  colocateChar: string = '+',
) {
  let routeSegments: string[] = []
  let i = 0
  let routeSegment = ''
  let state = 'START'
  let subState = 'NORMAL'

  // name has already been normalized to use / as path separator

  // Check if the last segment is a special route file that should be removed
  const specialRouteFiles = [
    'index',
    '_index',
    'route',
    '_route',
    'layout',
    '_layout',
    'page',
  ]
  const lastSegment = name.split('/').pop()
  const isSpecialFile = lastSegment && specialRouteFiles.includes(lastSegment)

  let hasFolder = /\//.test(name)
  // Only remove the last segment if it's a special route file
  if (hasFolder && isSpecialFile) {
    let last = name.lastIndexOf('/')
    if (last >= 0) {
      name = name.substring(0, last)
    }
  }

  let pushRouteSegment = (routeSegment: string) => {
    if (routeSegment) {
      routeSegments.push(routeSegment)
    }
  }

  while (i < name.length) {
    let char = name[i]
    switch (state) {
      case 'START':
        // process existing segment
        if (
          routeSegment.includes(paramChar) &&
          !(
            routeSegment.startsWith(paramChar) ||
            routeSegment.startsWith(`(${paramChar}`)
          )
        ) {
          throw new Error(
            `Route params must start with prefix char ${paramChar}: ${routeSegment}`,
          )
        }
        if (
          routeSegment.includes('(') &&
          !routeSegment.startsWith('(') &&
          !routeSegment.endsWith(')')
        ) {
          throw new Error(
            `Optional routes must start and end with parentheses: ${routeSegment}`,
          )
        }
        pushRouteSegment(routeSegment)
        routeSegment = ''
        state = 'PATH'
        continue // restart without advancing index
      case 'PATH':
        if (isPathSeparator(char) && subState === 'NORMAL') {
          state = 'START'
          break
        } else if (char === '[') {
          subState = 'ESCAPE'
        } else if (char === ']') {
          subState = 'NORMAL'
        }
        routeSegment += char
        break
    }
    i++ // advance to next character
  }
  // process remaining segment
  pushRouteSegment(routeSegment)
  // strip trailing .route segment
  if (routeSegments.at(-1) === 'route') {
    routeSegments = routeSegments.slice(0, -1)
  }
  return routeSegments
}
