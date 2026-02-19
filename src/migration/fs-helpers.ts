import fs from 'node:fs'
import path from 'node:path'

import { visitFiles as walkFiles } from '../fs/visit-files'
import { logInfo } from './logger'

export function visitFiles(dir: string, visitor: (file: string) => void): void {
  walkFiles(dir, visitor, { followSymlinks: false })
}

const ROUTE_ENTRY_BASENAMES = new Set(['route', 'index', '_index', '_layout'])

function isRouteEntryBasename(basename: string): boolean {
  const ext = path.extname(basename)
  const name = ext ? basename.slice(0, -ext.length) : basename
  return ROUTE_ENTRY_BASENAMES.has(name)
}

function isRouteSegment(segment: string): boolean {
  if (segment === '' || segment === '.') return true
  if (segment.endsWith('+')) return true
  if (segment.startsWith('(') && segment.endsWith(')')) return true
  if (segment.startsWith('__')) return true
  if (segment.startsWith('_')) return true
  return false
}

export function isColocatedFile(filename: string): boolean {
  const normalized = filename.replace(/\\/g, '/')
  const segments = normalized.split('/')
  if (segments.length <= 1) return false

  const directorySegments = segments.slice(0, -1)
  const basename = segments[segments.length - 1]
  const usesFlatFilesConvention = directorySegments.some((segment) =>
    segment.endsWith('+'),
  )

  if (!usesFlatFilesConvention) return false

  if (basename.startsWith('__')) {
    return true
  }

  // Count how many "regular" (non-route) directory segments exist after the
  // last `+` parent. In remix-flat-routes, the first directory after a `+`
  // folder is a route folder (e.g. `demo+/about/route.tsx`). Files named as
  // route entries directly inside such a folder are route modules, not
  // colocated files. Deeper regular directories indicate colocated content.
  let lastPlusIndex = -1
  for (let i = directorySegments.length - 1; i >= 0; i--) {
    if (directorySegments[i].endsWith('+')) {
      lastPlusIndex = i
      break
    }
  }

  const segmentsAfterPlus = directorySegments.slice(lastPlusIndex + 1)
  const regularSegments = segmentsAfterPlus.filter(
    (segment) => !isRouteSegment(segment),
  )

  // If there's exactly one regular directory after the last `+` folder and
  // the file is a route entry (route.tsx, index.tsx, etc.), this is a folder
  // route — not a colocated file.
  if (regularSegments.length <= 1 && isRouteEntryBasename(basename)) {
    return false
  }

  return regularSegments.length > 0
}

export function defaultTargetDir(sourceDir: string): string {
  const absolute = path.resolve(sourceDir)
  const parent = path.dirname(absolute)
  const fallback = path.join(parent, 'new-routes')
  return pathRelative(process.cwd(), fallback)
}

export function swapRoutes(
  sourceDir: string,
  targetDir: string,
  backupDir: string,
): void {
  if (!fs.existsSync(targetDir)) {
    throw new Error(`target directory '${targetDir}' was not created`)
  }

  const workingDir = process.cwd()
  const sourceRelative = pathRelative(workingDir, sourceDir)
  const targetRelative = pathRelative(workingDir, targetDir)
  const backupRelative = pathRelative(workingDir, backupDir)

  fs.renameSync(sourceDir, backupDir)
  logInfo(`📦 Backed up '${sourceRelative}' to '${backupRelative}'.`)
  fs.renameSync(targetDir, sourceDir)
  logInfo(`🚀 Promoted '${targetRelative}' to '${sourceRelative}'.`)
}

export function revertRoutes(
  sourceDir: string,
  targetDir: string,
  backupDir: string,
): void {
  const workingDir = process.cwd()
  const sourceRelative = pathRelative(workingDir, sourceDir)
  const targetRelative = pathRelative(workingDir, targetDir)
  const backupRelative = pathRelative(workingDir, backupDir)

  if (fs.existsSync(sourceDir)) {
    fs.renameSync(sourceDir, targetDir)
    logInfo(
      `↩️ Returned '${sourceRelative}' back to '${targetRelative}' for review.`,
    )
  }

  if (fs.existsSync(backupDir)) {
    fs.renameSync(backupDir, sourceDir)
    logInfo(
      `🔄 Restored original routes from '${backupRelative}' to '${sourceRelative}'.`,
    )
  }
}

export function pathRelative(from: string, to: string): string {
  const relative = path.relative(from, to)
  return relative === '' ? '.' : relative
}

export function normalizeDirectoryPath(dir: string): string {
  if (dir === '') {
    return dir
  }

  let normalized = path.normalize(dir)

  if (normalized !== path.sep) {
    normalized = normalized.replace(/[\\/]+$/, '')
  }

  if (normalized === '.') {
    return normalized
  }

  const dotSlashPrefix = `.${path.sep}`
  if (normalized.startsWith(dotSlashPrefix)) {
    normalized = normalized.slice(dotSlashPrefix.length)
  }

  return normalized
}
