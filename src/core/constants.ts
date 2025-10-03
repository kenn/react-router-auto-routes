// Route file extensions
export const ROUTE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.md', '.mdx']

// Special route file names that should be stripped from segments
export const SPECIAL_ROUTE_FILES = [
  'index',
  '_index',
  'route',
  '_route',
  'layout',
  '_layout',
]

// Server-side file pattern
export const SERVER_FILE_REGEX = /\.server\.(ts|tsx|js|jsx|md|mdx)$/

// Route naming constants
export const PATHLESS_PREFIX = '_'
export const ROOT_PARENT = 'root'
