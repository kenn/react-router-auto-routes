export const MIGRATION_ROUTE_EXTENSIONS = Object.freeze([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.md',
  '.mdx',
])

export type MigrationRouteExtension =
  (typeof MIGRATION_ROUTE_EXTENSIONS)[number]

export const DOT_INDEX_SUFFIX = '.index'
export const DOT_UNDERSCORE_INDEX_SUFFIX = '._index'
