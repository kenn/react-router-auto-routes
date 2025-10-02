import { defaultVisitFiles } from '../utils'
import { getRouteRegex } from './route-detection'
import { autoRoutesOptions, ResolvedOptions } from './types'

const DEFAULT_ROUTE_REGEX =
  /((\${colocateChar}[\/\\][^\/\\:?*]+)|[\/\\]((index|route|layout|page)|(_[^\/\\:?*]+)|([^\/\\:?*]+\.route)|([^\/\\:?*]+)))\.(ts|tsx|js|jsx|md|mdx)$/

const DEFAULT_OPTIONS = Object.freeze({
  appDir: 'app',
  routeDir: 'routes',
  basePath: '/',
  paramChar: '$',
  colocateChar: '+',
  routeRegex: DEFAULT_ROUTE_REGEX,
})

export function resolveOptions(
  options: autoRoutesOptions = {},
): ResolvedOptions {
  const {
    appDir = DEFAULT_OPTIONS.appDir,
    routeDir = DEFAULT_OPTIONS.routeDir,
    basePath = DEFAULT_OPTIONS.basePath,
    paramChar = DEFAULT_OPTIONS.paramChar,
    colocateChar: userColocateChar,
    routeRegex: userRouteRegex,
    ignoredRouteFiles = [],
    visitFiles: userVisitFiles,
  } = options

  const colocateChar = userColocateChar ?? DEFAULT_OPTIONS.colocateChar
  const visitFiles = userVisitFiles ?? defaultVisitFiles
  const routeRegexSource = userRouteRegex ?? DEFAULT_OPTIONS.routeRegex
  const routeRegex = getRouteRegex(routeRegexSource, colocateChar)
  const routeDirsArray = Array.isArray(routeDir) ? [...routeDir] : [routeDir]

  return {
    appDir,
    routeDirs: Object.freeze(routeDirsArray),
    basePath,
    visitFiles,
    paramChar,
    colocateChar,
    ignoredRouteFiles: Object.freeze([...ignoredRouteFiles]),
    routeRegex,
  }
}

export const defaultOptions = DEFAULT_OPTIONS
