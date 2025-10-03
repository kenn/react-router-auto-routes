import fs from 'node:fs'
import path from 'node:path'

export function visitFiles(
  dir: string,
  visitor: (file: string) => void,
): void {
  const rootDir = dir

  const walk = (currentDir: string) => {
    for (const filename of fs.readdirSync(currentDir)) {
      const file = path.resolve(currentDir, filename)
      const stat = fs.lstatSync(file)

      if (stat.isDirectory()) {
        walk(file)
      } else if (stat.isFile()) {
        visitor(path.relative(rootDir, file))
      }
    }
  }

  walk(dir)
}

export function isColocatedFile(filename: string): boolean {
  const normalized = filename.replace(/\\/g, '/')
  const segments = normalized.split('/')
  if (segments.length <= 1) return false

  const directorySegments = segments.slice(0, -1)
  const usesFlatFilesConvention = directorySegments.some((segment) =>
    segment.endsWith('+'),
  )

  if (!usesFlatFilesConvention) return false

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
