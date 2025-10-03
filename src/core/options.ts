import { defaultVisitFiles, escapeRegexChar, normalizeRoutesDir } from '../utils'
import { autoRoutesOptions, ResolvedOptions } from './types'
import {
  DEFAULT_ROOT_DIR,
  DEFAULT_ROUTES_DIR,
  DEFAULT_BASE_PATH,
  DEFAULT_PARAM_CHAR,
  DEFAULT_COLOCATE_CHAR,
  DEFAULT_ROUTE_REGEX,
} from './constants'

export function resolveOptions(
  options: autoRoutesOptions = {},
): ResolvedOptions {
  const {
    rootDir: rawRootDir = DEFAULT_ROOT_DIR,
    routesDir = DEFAULT_ROUTES_DIR,
    basePath = DEFAULT_BASE_PATH,
    paramChar = DEFAULT_PARAM_CHAR,
    colocateChar: userColocateChar,
    routeRegex: userRouteRegex,
    ignoredRouteFiles = [],
    visitFiles: userVisitFiles,
  } = options

  const colocateChar = userColocateChar ?? DEFAULT_COLOCATE_CHAR
  const visitFiles = userVisitFiles ?? defaultVisitFiles
  const routeRegexSource = userRouteRegex ?? DEFAULT_ROUTE_REGEX

  // Inline regex replacement logic
  const escapedColocateChar = escapeRegexChar(colocateChar)
  const routeRegex = new RegExp(
    routeRegexSource.source.replace('\\${colocateChar}', `\\${escapedColocateChar}`),
    routeRegexSource.flags,
  )

  const rootDir = rawRootDir.trim() === '' ? '.' : rawRootDir.trim()
  const routeDirsArray = Array.isArray(routesDir) ? [...routesDir] : [routesDir]
  const normalizedRouteDirs = routeDirsArray.map((dir) => normalizeRoutesDir(dir))

  return {
    rootDir,
    routeDirs: Object.freeze(normalizedRouteDirs),
    basePath,
    visitFiles,
    paramChar,
    colocateChar,
    ignoredRouteFiles: Object.freeze([...ignoredRouteFiles]),
    routeRegex,
  }
}
