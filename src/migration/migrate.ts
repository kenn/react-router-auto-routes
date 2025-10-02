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
    // convert path separators to hybrid format using + folder separator
    .replace(pathSepRegex, '+/')
    // convert single _ to [_] due to conflict with new pathless layout prefix
    .replace(/(^|\/|\.)_([^_.])/g, '$1[_]$2')
    // convert double __ to single _ for pathless layout prefix
    .replace(/(^|\/|\.)__/g, '$1_')
    // convert index to _index for index routes
    .replace(/(^|\/|\.)index$/, '$1_index')

  // check if route is a parent route
  // if so, move to hybrid folder (+) as _layout route
  if (Object.values(routes).some((r) => r.parentId === id)) {
    flat = flat + '+/_layout'
  }

  return flat
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
