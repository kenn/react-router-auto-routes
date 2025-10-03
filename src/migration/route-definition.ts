import { createRouteId } from '../utils'

interface ConfigRoute {
  path?: string
  index?: boolean
  caseSensitive?: boolean
  id: string
  parentId?: string
  file: string
}

export type RouteManifest = Record<string, ConfigRoute>

interface DefineRouteOptions {
  caseSensitive?: boolean
  index?: boolean
  id?: string
}

interface DefineRouteChildren {
  (): void
}

export interface DefineRouteFunction {
  (
    path: string | undefined,

    file: string,

    optionsOrChildren?: DefineRouteOptions | DefineRouteChildren,
    children?: DefineRouteChildren,
  ): void
}

export type DefineRoutesFunction = typeof defineRoutes

/**
 * A function for defining routes programmatically, instead of using the
 * filesystem convention.
 */
export function defineRoutes(
  callback: (defineRoute: DefineRouteFunction) => void,
): RouteManifest {
  let routes: RouteManifest = Object.create(null)
  let parentRoutes: ConfigRoute[] = []
  let alreadyReturned = false

  let defineRoute: DefineRouteFunction = (
    path,
    file,
    optionsOrChildren,
    children,
  ) => {
    if (alreadyReturned) {
      throw new Error(
        'You tried to define routes asynchronously but started defining ' +
          'routes before the async work was done. Please await all async ' +
          'data before calling `defineRoutes()`',
      )
    }

    let options: DefineRouteOptions
    if (typeof optionsOrChildren === 'function') {
      // route(path, file, children)
      options = {}
      children = optionsOrChildren
    } else {
      // route(path, file, options, children)
      // route(path, file, options)
      options = optionsOrChildren || {}
    }

    let route: ConfigRoute = {
      path: path ? path : undefined,
      index: options.index ? true : undefined,
      caseSensitive: options.caseSensitive ? true : undefined,
      id: options.id || createRouteId(file),
      parentId:
        parentRoutes.length > 0
          ? parentRoutes[parentRoutes.length - 1].id
          : 'root',
      file,
    }

    if (route.id in routes) {
      throw new Error(
        `Unable to define routes with duplicate route id: "${route.id}"`,
      )
    }

    routes[route.id] = route

    if (children) {
      parentRoutes.push(route)
      children()
      parentRoutes.pop()
    }
  }

  callback(defineRoute)

  alreadyReturned = true

  return routes
}
