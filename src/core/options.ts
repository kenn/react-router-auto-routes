import { defaultVisitFiles, escapeRegexChar } from '../utils'
import { autoRoutesOptions, ResolvedOptions } from './types'
import {
  DEFAULT_APP_DIR,
  DEFAULT_ROUTE_DIR,
  DEFAULT_BASE_PATH,
  DEFAULT_PARAM_CHAR,
  DEFAULT_COLOCATE_CHAR,
  DEFAULT_ROUTE_REGEX,
} from './constants'

export function resolveOptions(
  options: autoRoutesOptions = {},
): ResolvedOptions {
  const {
    appDir = DEFAULT_APP_DIR,
    routeDir = DEFAULT_ROUTE_DIR,
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
