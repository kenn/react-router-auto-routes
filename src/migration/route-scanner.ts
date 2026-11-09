import fs from 'node:fs'
import path from 'node:path'
import picomatch from 'picomatch'
import { ROUTE_EXTENSIONS } from '../core/routing/files'
import { createRouteId, toPosixPath, visitFiles } from '../utils'
import { isColocatedFile } from './fs-helpers'

export type ScanRouteModulesOptions = {
  appDirectory: string
  routesDirectory: string
  ignoredFilePatterns: string[]
}

export function scanRouteModules(
  options: ScanRouteModulesOptions,
): Record<string, string> {
  const { appDirectory, routesDirectory, ignoredFilePatterns } = options

  const appRoutesDirectory = path.join(appDirectory, routesDirectory)
  if (!fs.existsSync(appRoutesDirectory)) {
    throw new Error(`Routes directory not found: ${appRoutesDirectory}`)
  }

  const files: Record<string, string> = {}

  visitFiles(appRoutesDirectory, (file) => {
    if (
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
    if (ROUTE_EXTENSIONS.includes(extension)) {
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
        routeId = toPosixPath(path.dirname(relativePath))
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
