import * as fs from 'fs'
import * as path from 'path'
import { createRoutesFromFolders } from './lib'
import { defineRoutes, type RouteManifest } from './routes'

export type MigrateOptions = {
  force: boolean
  ignoredRouteFiles?: string[]
}

const pathSepRegex = new RegExp(`\\${path.sep}`, 'g')
const routeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.md', '.mdx']

export function migrate(
  sourceDir: string,
  targetDir: string,
  options: MigrateOptions = {
    force: false,
    ignoredRouteFiles: undefined,
  },
) {
  sourceDir = normalizeDirectoryPath(sourceDir)
  targetDir = normalizeDirectoryPath(targetDir)

  console.log('🛠️ Migrating routes to + folder convention...')
  console.log(`🗂️ source: ${sourceDir}`)
  console.log(`🗂️ target: ${targetDir}`)
  console.log(`🙈ignored files: ${options.ignoredRouteFiles}`)
  console.log()

  const routes = createRoutesFromFolders(defineRoutes, {
    appDirectory: './',
    routesDirectory: sourceDir,
    ignoredFilePatterns: options.ignoredRouteFiles,
  })

  // Migrate route files
  Object.entries(routes).forEach(([id, route]) => {
    let { path: routePath, file, parentId } = route
    let extension = path.extname(file)
    // skip non-route files if not ignored above
    if (!routeExtensions.includes(extension)) {
      return
    }

    let flat = convertToRoute(
      routes,
      sourceDir,
      id,
      parentId!,
      routePath!,
      !!route.index,
    )

    // replace sourceDir with targetDir
    const targetFile = path.join(targetDir, `${flat}${extension}`)
    fs.mkdirSync(path.dirname(targetFile), { recursive: true })
    fs.cpSync(file, targetFile, { force: true })
  })

  // Migrate colocated files (files in folders without + suffix)
  visitFiles(sourceDir, (file) => {
    if (isColocatedFile(file)) {
      const sourcePath = path.join(sourceDir, file)
      const targetPath = path.join(targetDir, convertColocatedPath(file))
      fs.mkdirSync(path.dirname(targetPath), { recursive: true })
      fs.cpSync(sourcePath, targetPath, { force: true })
    }
  })

  console.log('🏁 Finished!')
}

export function convertToRoute(
  routes: RouteManifest,
  sourceDir: string,
  id: string,
  parentId: string,
  routePath: string,
  index: boolean,
) {
  // strip sourceDir from id and parentId
  let routeId = id.substring(sourceDir.length + 1)
  parentId =
    parentId === 'root' ? parentId : parentId.substring(sourceDir.length + 1)

  let flat = routeId
    // remove + suffix from folder names (old convention marker)
    .replace(/\+\//g, '/')
    // convert double __ to single _ for pathless layout prefix
    .replace(/(^|\/|\.)__/g, '$1_')

  // check if route is a parent route
  // if so, move to folder as _layout route
  if (Object.values(routes).some((r) => r.parentId === id)) {
    flat = flat + '/_layout'
  }

  return flat
}

function visitFiles(
  dir: string,
  visitor: (file: string) => void,
  baseDir = dir,
): void {
  for (let filename of fs.readdirSync(dir)) {
    let file = path.resolve(dir, filename)
    let stat = fs.lstatSync(file)

    if (stat.isDirectory()) {
      visitFiles(file, visitor, baseDir)
    } else if (stat.isFile()) {
      visitor(path.relative(baseDir, file))
    }
  }
}

function isColocatedFile(filename: string): boolean {
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

function convertColocatedPath(file: string): string {
  const normalized = file.replace(/\\/g, '/')
  const segments = normalized.split('/')

  // Find the first colocated folder (without + suffix)
  let colocatedFolderIndex = -1
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i]
    if (segment && !segment.endsWith('+') && segment !== '.' && segment !== '') {
      colocatedFolderIndex = i
      break
    }
  }

  // Process each segment
  const converted = segments.map((segment, index) => {
    const isLastSegment = index === segments.length - 1

    // Add + prefix to the first colocated folder
    if (index === colocatedFolderIndex) {
      return '+' + segment
    }

    // Remove + suffix from route folders
    if (!isLastSegment) {
      return segment.replace(/\+$/, '')
    }

    // Keep filename as-is
    return segment
  })

  return converted.join(path.sep)
}

function normalizeDirectoryPath(dir: string) {
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
