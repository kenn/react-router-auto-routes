import picomatch from 'picomatch'
import * as path from 'path'

import { isRouteModuleFile } from './route-detection'
import { getRouteInfo } from './route-info'
import { ResolvedOptions, RouteInfo } from './types'

export function collectRouteInfos(options: ResolvedOptions): RouteInfo[] {
  const {
    appDir,
    routeDirs,
    ignoredRouteFiles,
    visitFiles,
    colocateChar,
    routeRegex,
  } = options

  const routeMap = new Map<string, RouteInfo>()

  for (const currentRouteDir of routeDirs) {
    const directory = path.join(appDir, currentRouteDir)

    visitFiles(directory, (file) => {
      if (
        ignoredRouteFiles.length > 0 &&
        ignoredRouteFiles.some((pattern) =>
          picomatch.isMatch(file, pattern, { dot: true }),
        )
      ) {
        return
      }

      if (!isRouteModuleFile(file, colocateChar, routeRegex)) {
        return
      }

      const routeInfo = getRouteInfo(currentRouteDir, file, options)
      routeMap.set(routeInfo.id, routeInfo)
    })
  }

  return Array.from(routeMap.values())
}
