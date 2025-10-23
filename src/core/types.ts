export type RouteInfo = {
  id: string
  path: string | undefined
  file: string
  segments: string[]
  mountPath: string
  parentId?: string
  index?: boolean
}

export interface RouteConfig {
  id: string
  file: string
  path?: string
  index?: boolean
  children?: RouteConfig[]
}

export type VisitFilesFunction = (
  dir: string,
  visitor: (file: string) => void,
) => void

export type NormalizedRoutesDir = {
  mountPath: string
  fsDir: string
  idPrefix: string
  importPrefix: string
}

export type RoutesDirInput = string | Record<string, string>

export type autoRoutesOptions = {
  routesDir?: RoutesDirInput
  visitFiles?: VisitFilesFunction
  paramChar?: string
  colocationChar?: string
  ignoredRouteFiles?: readonly string[]
  routeRegex?: RegExp
}

export type ResolvedOptions = {
  routes: readonly NormalizedRoutesDir[]
  visitFiles: VisitFilesFunction
  paramChar: string
  colocationChar: string
  ignoredRouteFiles: readonly string[]
  routeRegex: RegExp
}
