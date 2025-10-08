import fs from 'node:fs'
import path from 'node:path'

import { visitFiles as walkFiles } from '../fs/visit-files'
import { logInfo } from './logger'

export function visitFiles(dir: string, visitor: (file: string) => void): void {
  walkFiles(dir, visitor, { followSymlinks: false })
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

  return directorySegments.some((segment) => {
    if (segment === '' || segment === '.') return false
    if (segment.endsWith('+')) return false
    if (segment.startsWith('(') && segment.endsWith(')')) return false
    if (segment.startsWith('__')) return false
    return true
  })
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
