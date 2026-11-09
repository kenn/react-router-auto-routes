import autoRoutes, { autoRoutesOptions, RouteConfig } from '../../src/core'
import type { VisitFilesFunction } from '../../src/core/types'

type FlatRoute = {
  file: string
  parentId: string
  path?: string
  index?: true
}

/**
 * One expected route: `[file, parent, path?, 'index'?]`.
 *
 * - `file` is the path handed to `visitFiles` (relative to `routes/`); the
 *   expected id and import path are derived from it.
 * - `parent` is `'root'` or a parent id without the `routes/` prefix.
 *
 * A bare string is a file that must not produce a route.
 */
export type RouteRow =
  | [file: string, parent: string, path?: string, index?: 'index']
  | string

export function createRoutesFromFiles(
  files: string[],
  options: autoRoutesOptions = {},
): RouteConfig[] {
  return autoRoutes({
    ...options,
    visitFiles:
      options.visitFiles ?? ((_dir, visitor) => files.forEach(visitor)),
  })
}

/** `visitFiles` that serves files by the routes directory suffix. */
export function filesByRoutesDir(
  filesByDir: Record<string, string[]>,
): VisitFilesFunction {
  const suffixes = Object.keys(filesByDir).sort((a, b) => b.length - a.length)
  return (dir, visitor) => {
    const normalized = dir.replace(/\\/g, '/')
    const suffix = suffixes.find((key) => normalized.endsWith(key))
    if (suffix) filesByDir[suffix].forEach(visitor)
  }
}

export function flattenRoutesById(
  routes: RouteConfig[],
): Record<string, FlatRoute> {
  const result: Record<string, FlatRoute> = {}

  const walk = (route: RouteConfig, parentId: string) => {
    result[route.id] = { file: route.file, parentId }
    if (route.path !== undefined) result[route.id].path = route.path
    if (route.index) result[route.id].index = true
    route.children?.forEach((child) => walk(child, route.id))
  }

  routes.forEach((route) => walk(route, 'root'))
  return result
}

/** Asserts the full id → { file, parentId, path, index } map for `rows`. */
export function expectRoutes(
  rows: RouteRow[],
  options: autoRoutesOptions = {},
): RouteConfig[] {
  const files = rows.map((row) => (typeof row === 'string' ? row : row[0]))
  const expected: Record<string, FlatRoute> = {}

  for (const row of rows) {
    if (typeof row === 'string') continue

    const [file, parent, path, index] = row
    const posixFile = file.replace(/\\/g, '/')
    const entry: FlatRoute = {
      file: `routes/${posixFile}`,
      parentId: parent === 'root' ? 'root' : `routes/${parent}`,
    }
    if (path !== undefined) entry.path = path
    if (index) entry.index = true
    expected[`routes/${posixFile.replace(/\.[a-z0-9]+$/i, '')}`] = entry
  }

  const routes = createRoutesFromFiles(files, options)
  expect(flattenRoutesById(routes)).toEqual(expected)
  return routes
}

export const flatFileRoutes = (): RouteRow[] => [
  ['$lang.$ref.tsx', 'root', ':lang/:ref'],
  ['$lang.$ref._index.tsx', 'root', ':lang/:ref', 'index'],
  ['$lang.$ref.$.tsx', 'root', ':lang/:ref/*'],
  ['_index.tsx', 'root', undefined, 'index'],
  ['healthcheck.tsx', 'root', 'healthcheck'],
]

export const flatFolderRoutes = (): RouteRow[] => [
  ['$lang.$ref/route.tsx', 'root', ':lang/:ref'],
  ['$lang.$ref._index/route.tsx', 'root', ':lang/:ref', 'index'],
  ['$lang.$ref.$/route.tsx', 'root', ':lang/:ref/*'],
  ['_index/route.tsx', 'root', undefined, 'index'],
  ['healthcheck/route.tsx', 'root', 'healthcheck'],
]
