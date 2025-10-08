import picomatch from 'picomatch'
import fs from 'node:fs'
import path from 'node:path'
import { createRouteId } from '../utils'
import { isColocatedFile, visitFiles } from './fs-helpers'
import {
  DefineRouteFunction,
  DefineRoutesFunction,
  RouteManifest,
} from './route-definition'

const paramChar = '$' as const
const escapeStart = '[' as const
const escapeEnd = ']' as const
const optionalStart = '(' as const
const optionalEnd = ')' as const

let routeModuleExts = ['.js', '.jsx', '.ts', '.tsx', '.md', '.mdx']
const ignoredFilenames = new Set(['.DS_Store'])

function isRouteModuleFile(filename: string): boolean {
  return routeModuleExts.includes(path.extname(filename))
}

export type CreateRoutesFromFoldersOptions = {
  /**
   * The directory where your app lives. Defaults to `app`.
   * @default "app"
   */
  appDirectory?: string
  /**
   * A list of glob patterns to ignore when looking for route modules.
   * Defaults to `[]`.
   */
  ignoredFilePatterns?: string[]
  /**
   * The directory where your routes live. Defaults to `routes`.
   * This is relative to `appDirectory`.
   * @default "routes"
   */
  routesDirectory?: string
}

/**
 * Defines routes using the filesystem convention in `app/routes`. The rules are:
 *
 * - Route paths are derived from the file path. A `.` in the filename indicates
 *   a `/` in the URL (a "nested" URL, but no route nesting). A `$` in the
 *   filename indicates a dynamic URL segment.
 * - Subdirectories are used for nested routes.
 *
 * For example, a file named `app/routes/gists/$username.tsx` creates a route
 * with a path of `gists/:username`.
 */
export function createRoutesFromFolders(
  defineRoutes: DefineRoutesFunction,
  options: CreateRoutesFromFoldersOptions = {},
): RouteManifest {
  let {
    appDirectory = 'app',
    ignoredFilePatterns = [],
    routesDirectory = 'routes',
  } = options

  let appRoutesDirectory = path.join(appDirectory, routesDirectory)
  if (!fs.existsSync(appRoutesDirectory)) {
    throw new Error(`Routes directory not found: ${appRoutesDirectory}`)
  }
  let files: { [routeId: string]: string } = {}

  // First, find all route modules in app/routes
  visitFiles(appRoutesDirectory, (file) => {
    const basename = path.basename(file)
    if (ignoredFilenames.has(basename)) {
      return
    }

    if (
      ignoredFilePatterns.length > 0 &&
      ignoredFilePatterns.some((pattern) => picomatch.isMatch(file, pattern))
    ) {
      return
    }

    if (isColocatedFile(file)) {
      return
    }

    if (isRouteModuleFile(file)) {
      let relativePath = path.join(routesDirectory, file)
      let routeId = createRouteId(relativePath)
      files[routeId] = relativePath
      return
    }

    throw new Error(
      `Invalid route module file: ${path.join(appRoutesDirectory, file)}`,
    )
  })

  let routeIds = Object.keys(files).sort(byLongestFirst)
  let parentRouteIds = getParentRouteIds(routeIds)
  let uniqueRoutes = new Map<string, string>()

  // Then, recurse through all routes using the public defineRoutes() API
  function defineNestedRoutes(
    defineRoute: DefineRouteFunction,
    parentId?: string,
  ): void {
    let childRouteIds = routeIds.filter((id) => {
      return parentRouteIds[id] === parentId
    })

    for (let routeId of childRouteIds) {
      let routePath: string | undefined = createRoutePath(
        routeId.slice((parentId || routesDirectory).length + 1),
      )

      let isIndexRoute = routeId.endsWith('/index')
      let fullPath = createRoutePath(routeId.slice(routesDirectory.length + 1))
      let uniqueRouteId = (fullPath || '') + (isIndexRoute ? '?index' : '')
      let isPathlessLayoutRoute =
        routeId.split('/').pop()?.startsWith('__') === true

      /**
       * We do not try to detect path collisions for pathless layout route
       * files because, by definition, they create the potential for route
       * collisions _at that level in the tree_.
       *
       * Consider example where a user may want multiple pathless layout routes
       * for different subfolders
       *
       *   routes/
       *     account.tsx
       *     account/
       *       __public/
       *         login.tsx
       *         perks.tsx
       *       __private/
       *         orders.tsx
       *         profile.tsx
       *       __public.tsx
       *       __private.tsx
       *
       * In order to support both a public and private layout for `/account/*`
       * URLs, we are creating a mutually exclusive set of URLs beneath 2
       * separate pathless layout routes.  In this case, the route paths for
       * both account/__public.tsx and account/__private.tsx is the same
       * (/account), but we're again not expecting to match at that level.
       *
       * By only ignoring this check when the final portion of the filename is
       * pathless, we will still detect path collisions such as:
       *
       *   routes/parent/__pathless/foo.tsx
       *   routes/parent/__pathless2/foo.tsx
       *
       * and
       *
       *   routes/parent/__pathless/index.tsx
       *   routes/parent/__pathless2/index.tsx
       */
      if (uniqueRouteId && !isPathlessLayoutRoute) {
        if (uniqueRoutes.has(uniqueRouteId)) {
          throw new Error(
            `Path ${JSON.stringify(fullPath || '/')} defined by route ` +
              `${JSON.stringify(routeId)} conflicts with route ` +
              `${JSON.stringify(uniqueRoutes.get(uniqueRouteId))}`,
          )
        } else {
          uniqueRoutes.set(uniqueRouteId, routeId)
        }
      }

      if (isIndexRoute) {
        let invalidChildRoutes = routeIds.filter(
          (id) => parentRouteIds[id] === routeId,
        )

        if (invalidChildRoutes.length > 0) {
          throw new Error(
            `Child routes are not allowed in index routes. Please remove child routes of ${routeId}`,
          )
        }

        defineRoute(routePath, files[routeId], { index: true, id: routeId })
      } else {
        defineRoute(routePath, files[routeId], { id: routeId }, () => {
          defineNestedRoutes(defineRoute, routeId)
        })
      }
    }
  }

  return defineRoutes(defineNestedRoutes)
}

const segmentSeparators = new Set(['/', '.', path.win32.sep])

type RouteToken =
  | { kind: 'literal'; value: string }
  | { kind: 'separator' }
  | { kind: 'param'; isSplat: boolean }
  | { kind: 'optionalStart' }
  | { kind: 'optionalEnd' }

function isSegmentSeparator(checkChar: string | undefined): boolean {
  return checkChar !== undefined && segmentSeparators.has(checkChar)
}

function tokenizeRoutePattern(partialRouteId: string): RouteToken[] {
  const tokens: RouteToken[] = []
  let literalBuffer = ''
  let segmentStarted = false

  const flushLiteral = () => {
    if (literalBuffer) {
      tokens.push({ kind: 'literal', value: literalBuffer })
      literalBuffer = ''
      segmentStarted = true
    }
  }

  let inEscapeSequence = 0
  let skipSegment = false
  let optionalActive = false

  for (let index = 0; index < partialRouteId.length; index++) {
    const char = partialRouteId.charAt(index)
    const prevChar =
      index > 0 ? partialRouteId.charAt(index - 1) : undefined
    const nextChar =
      index < partialRouteId.length - 1
        ? partialRouteId.charAt(index + 1)
        : undefined

    if (skipSegment) {
      if (isSegmentSeparator(char)) {
        skipSegment = false
      }
      continue
    }

    const isEscapeStart =
      !inEscapeSequence && char === escapeStart && prevChar !== escapeStart
    if (isEscapeStart) {
      inEscapeSequence++
      continue
    }

    const isEscapeEnd =
      inEscapeSequence > 0 && char === escapeEnd && nextChar !== escapeEnd
    if (isEscapeEnd) {
      inEscapeSequence--
      continue
    }

    const canOpenOptional =
      !inEscapeSequence &&
      char === optionalStart &&
      prevChar !== optionalStart &&
      (prevChar === undefined || isSegmentSeparator(prevChar)) &&
      !optionalActive
    if (canOpenOptional) {
      flushLiteral()
      tokens.push({ kind: 'optionalStart' })
      optionalActive = true
      continue
    }

    const canCloseOptional =
      !inEscapeSequence &&
      optionalActive &&
      char === optionalEnd &&
      nextChar !== optionalEnd &&
      (nextChar === undefined || isSegmentSeparator(nextChar))
    if (canCloseOptional) {
      flushLiteral()
      tokens.push({ kind: 'optionalEnd' })
      optionalActive = false
      continue
    }

    if (inEscapeSequence) {
      literalBuffer += char
      continue
    }

    if (isSegmentSeparator(char)) {
      flushLiteral()
      tokens.push({ kind: 'separator' })
      optionalActive = false
      segmentStarted = false
      continue
    }

    const isLayoutPrefix =
      char === '_' && nextChar === '_' && !segmentStarted && literalBuffer === ''
    if (isLayoutPrefix) {
      skipSegment = true
      segmentStarted = false
      continue
    }

    if (char === paramChar) {
      if (nextChar === optionalEnd) {
        throw new Error(
          `Invalid route path: ${partialRouteId}. Splat route $ is already optional`,
        )
      }
      flushLiteral()
      tokens.push({ kind: 'param', isSplat: nextChar === undefined })
      segmentStarted = true
      continue
    }

    literalBuffer += char
  }

  if (literalBuffer) {
    tokens.push({ kind: 'literal', value: literalBuffer })
  }

  return tokens
}

function buildRouteFromTokens(
  tokens: RouteToken[],
  partialRouteId: string,
): string | undefined {
  let result = ''
  let currentSegment = ''
  let optionalSegmentIndex: number | null = null

  const appendLiteral = (value: string) => {
    result += value
    currentSegment += value
  }

  const appendParam = (token: Extract<RouteToken, { kind: 'param' }>) => {
    result += token.isSplat ? '*' : ':'
    currentSegment += paramChar
  }

  const applySegmentBoundary = () => {
    if (currentSegment === 'index' && result.endsWith('index')) {
      result = result.replace(/\/?index$/, '')
    } else {
      result += '/'
    }
    currentSegment = ''
    optionalSegmentIndex = null
  }

  const finalizeResult = () => {
    if (currentSegment === 'index' && result.endsWith('index')) {
      result = result.replace(/\/?index$/, '')
    } else {
      result = result.replace(/\/$/, '')
    }

    if (currentSegment === 'index' && result.endsWith('index?')) {
      throw new Error(
        `Invalid route path: ${partialRouteId}. Make index route optional by using (index)`,
      )
    }
  }

  for (const token of tokens) {
    switch (token.kind) {
      case 'literal': {
        appendLiteral(token.value)
        break
      }
      case 'param': {
        appendParam(token)
        break
      }
      case 'separator': {
        applySegmentBoundary()
        break
      }
      case 'optionalStart': {
        optionalSegmentIndex = result.length
        result += optionalStart
        break
      }
      case 'optionalEnd': {
        if (optionalSegmentIndex !== null) {
          result =
            result.slice(0, optionalSegmentIndex) +
            result.slice(optionalSegmentIndex + 1)
        }
        optionalSegmentIndex = null
        result += '?'
        break
      }
    }
  }

  finalizeResult()
  return result || undefined
}

export function createRoutePath(partialRouteId: string): string | undefined {
  const tokens = tokenizeRoutePattern(partialRouteId)
  return buildRouteFromTokens(tokens, partialRouteId)
}

function getParentRouteIds(
  routeIds: string[],
): Record<string, string | undefined> {
  // We could use Array objects directly below, but Map is more performant,
  // especially for larger arrays of routeIds,
  // due to the faster lookups provided by the Map data structure.
  const routeIdMap = new Map<string, string>()
  for (const routeId of routeIds) {
    routeIdMap.set(routeId, routeId)
  }

  const parentRouteIdMap = new Map<string, string | undefined>()
  for (const [childRouteId, _] of routeIdMap) {
    let parentRouteId: string | undefined = undefined
    for (const [potentialParentId, _] of routeIdMap) {
      if (childRouteId.startsWith(`${potentialParentId}/`)) {
        parentRouteId = potentialParentId
        break
      }
    }

    parentRouteIdMap.set(childRouteId, parentRouteId)
  }

  return Object.fromEntries(parentRouteIdMap)
}

function byLongestFirst(a: string, b: string): number {
  return b.length - a.length
}
