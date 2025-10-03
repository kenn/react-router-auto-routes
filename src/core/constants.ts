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
  'page',
]

// Server-side file pattern
export const SERVER_FILE_REGEX = /\.server\.(ts|tsx|js|jsx|md|mdx)$/

// Default configuration values
export const DEFAULT_ROOT_DIR = 'app'
export const DEFAULT_ROUTES_DIR = 'routes'
export const DEFAULT_BASE_PATH = '/'
export const DEFAULT_PARAM_CHAR = '$'
export const DEFAULT_COLOCATE_CHAR = '+'

// Route naming constants
export const PATHLESS_PREFIX = '_'
export const ROOT_PARENT = 'root'

// Default route regex pattern
export const DEFAULT_ROUTE_REGEX =
  /((\${colocateChar}[\/\\][^\/\\:?*]+)|[\/\\]((index|route|layout|page)|(_[^\/\\:?*]+)|([^\/\\:?*]+\.route)|([^\/\\:?*]+)))\.(ts|tsx|js|jsx|md|mdx)$/
