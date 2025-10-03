import fs from 'node:fs'
import path from 'node:path'

const LEGACY_PATTERNS = [
  'remix-flat-routes',
  'createRoutesFromFolders',
  'flatRoutes',
  '@react-router/remix-routes-option-adapter',
]

const NEXT_PATTERNS = ['react-router-auto-routes']

const ENTRY_CANDIDATES = ['routes.ts', 'routes.tsx', 'routes.js', 'routes.jsx']

export function detectLegacyRouteEntry(sourceDir: string): {
  entryPath: string | null
  isLegacy: boolean
} {
  const appDir = path.dirname(sourceDir)

  for (const candidate of ENTRY_CANDIDATES) {
    const candidatePath = path.join(appDir, candidate)
    if (!fs.existsSync(candidatePath) || !fs.statSync(candidatePath).isFile()) {
      continue
    }

    let contents: string
    try {
      contents = fs.readFileSync(candidatePath, 'utf8')
    } catch {
      continue
    }

    if (NEXT_PATTERNS.some((pattern) => contents.includes(pattern))) {
      return { entryPath: candidatePath, isLegacy: false }
    }

    if (LEGACY_PATTERNS.some((pattern) => contents.includes(pattern))) {
      return { entryPath: candidatePath, isLegacy: true }
    }
  }

  return { entryPath: null, isLegacy: false }
}
