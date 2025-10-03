import fs from 'node:fs'
import path from 'node:path'

import { pathRelative } from './utils'

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

  fs.renameSync(sourceDir, backupDir)
  fs.renameSync(targetDir, sourceDir)
}

export function revertRoutes(
  sourceDir: string,
  targetDir: string,
  backupDir: string,
): void {
  if (fs.existsSync(sourceDir)) {
    fs.renameSync(sourceDir, targetDir)
  }

  if (fs.existsSync(backupDir)) {
    fs.renameSync(backupDir, sourceDir)
  }
}
