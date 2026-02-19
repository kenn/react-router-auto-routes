import fs from 'node:fs'
import path from 'node:path'
import picomatch from 'picomatch'

import { createRouteId, defaultVisitFiles } from '../utils'
import { MIGRATION_ROUTE_EXTENSIONS } from './constants'
import { isColocatedFile } from './fs-helpers'

const ignoredFilenames = new Set(['.DS_Store'])

export type RouteModuleMap = Record<string, string>

export type ScanRouteModulesOptions = {
  appDirectory: string
  routesDirectory: string
  ignoredFilePatterns: string[]
}

export function scanRouteModules(
  options: ScanRouteModulesOptions,
): RouteModuleMap {
  const { appDirectory, routesDirectory, ignoredFilePatterns } = options

  const appRoutesDirectory = path.join(appDirectory, routesDirectory)
  if (!fs.existsSync(appRoutesDirectory)) {
    throw new Error(`Routes directory not found: ${appRoutesDirectory}`)
  }

  const files: RouteModuleMap = {}

  defaultVisitFiles(appRoutesDirectory, (file) => {
    const basename = path.basename(file)
    if (ignoredFilenames.has(basename)) {
      return
    }

    if (
      ignoredFilePatterns.length > 0 &&
      ignoredFilePatterns.some((pattern) =>
        picomatch.isMatch(file, pattern, { dot: true }),
      )
    ) {
      return
    }

    if (isColocatedFile(file)) {
      return
    }

    const extension = path.extname(file)
    if (MIGRATION_ROUTE_EXTENSIONS.includes(extension)) {
      const relativePath = path.join(routesDirectory, file)
      const basename = path.basename(file, extension)
      // In the folder route convention, `route.tsx` inside a folder means
      // the folder itself is the route. Strip the `/route` segment so the
      // route ID matches the folder name (same as remix-flat-routes).
      let routeId: string
      if (basename === 'route') {
        // Use directory path directly as route ID — don't use createRouteId
        // here because it strips dot-segments (e.g. `.biography` from
        // `($lang).biography`).
        routeId = path.dirname(relativePath).split(path.win32.sep).join('/')
      } else {
        routeId = createRouteId(relativePath)
      }
      files[routeId] = relativePath
      return
    }

    throw new Error(
      `Invalid route module file: ${path.join(appRoutesDirectory, file)}`,
    )
  })

  return files
}
