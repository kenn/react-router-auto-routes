export type RouteInfo = {
  id: string
  path: string | undefined
  file: string
  name: string
  segments: string[]
  parentId?: string
  index?: boolean
  caseSensitive?: boolean
  synthetic?: boolean // Auto-generated parent route without a physical file
}

export interface RouteConfig {
  id: string
  file?: string // Optional for synthetic parent routes
  path?: string
  index?: boolean
  caseSensitive?: boolean
  children?: RouteConfig[]
}

export type VisitFilesFunction = (
  dir: string,
  visitor: (file: string) => void,
  baseDir?: string,
) => void

export type autoRoutesOptions = {
  appDir?: string
  routeDir?: string | string[]
  basePath?: string
  visitFiles?: VisitFilesFunction
  paramChar?: string
  colocateChar?: string
  ignoredRouteFiles?: string[]
  routeRegex?: RegExp
}
