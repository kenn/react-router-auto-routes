import autoRoutes, { autoRoutesOptions, RouteConfig } from '../../src/index'

type RecordWithUnknownValues = Record<string, unknown>

export type RouteSnapshot = RouteConfig[]

type FlattenedRouteEntry = {
  file: string
  parentId: string
  path?: string
  index?: boolean
  caseSensitive?: boolean
}

export type ExpectedRouteSnapshot = Record<string, Partial<FlattenedRouteEntry>>

export type RouteFixtureExpectation = {
  id: string
  parentId?: string
  path?: string
  index?: boolean
  caseSensitive?: boolean
  file?: string
}

export type RouteFixture = {
  file: string
  expectation?: RouteFixtureExpectation
}

export type ExpectedValues = {
  id: string
  path: string | undefined
  parentId?: string
}

export function stripUndefined<T extends RecordWithUnknownValues>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as Partial<T>
}

function flattenRoutes(
  routes: RouteSnapshot,
  parentId: string = 'root',
  acc: Record<string, Partial<FlattenedRouteEntry>> = {},
) {
  for (const route of routes) {
    acc[route.id] = stripUndefined({
      file: route.file,
      parentId,
      path: route.path,
      index: route.index,
      caseSensitive: route.caseSensitive,
    })

    if (route.children && route.children.length > 0) {
      flattenRoutes(route.children, route.id, acc)
    }
  }

  return acc
}

export function flattenRoutesById(
  routes: RouteSnapshot,
): Record<string, Partial<FlattenedRouteEntry>> {
  const acc: Record<string, Partial<FlattenedRouteEntry>> = {}

  const walk = (route: RouteConfig, parentId: string) => {
    acc[route.id] = stripUndefined({
      file: route.file,
      parentId,
      path: route.path,
      index: route.index,
      caseSensitive: route.caseSensitive,
    })

    if (route.children && route.children.length > 0) {
      route.children.forEach((child) => walk(child, route.id))
    }
  }

  routes.forEach((route) => walk(route, 'root'))

  return acc
}

export function normalizeRoutes(routes: RouteSnapshot): ExpectedRouteSnapshot {
  return flattenRoutes(routes)
}

export function expectRoutesToMatch(
  routes: RouteSnapshot,
  expected: ExpectedRouteSnapshot,
) {
  expect(normalizeRoutes(routes)).toEqual(expected)
}

export function visitFilesFromArray(files: string[]) {
  return (_dir: string, visitor: (file: string) => void) => {
    files.forEach((file) => {
      visitor(file)
    })
  }
}

export function createRoutesFromFiles(
  files: string[],
  options: autoRoutesOptions = {},
): RouteSnapshot {
  return autoRoutes({
    ...options,
    visitFiles: options.visitFiles ?? visitFilesFromArray(files),
  })
}

export function expectFilesToMatchSnapshot(
  files: string[],
  expected: ExpectedRouteSnapshot,
  options: autoRoutesOptions = {},
): RouteSnapshot {
  const routes = createRoutesFromFiles(files, options)
  expectRoutesToMatch(routes, expected)
  return routes
}

export const route = (
  file: string,
  expectation: RouteFixtureExpectation,
): RouteFixture => ({
  file,
  expectation,
})

export const fileOnly = (file: string): RouteFixture => ({ file })

export function createRouteFixtures(fixtures: RouteFixture[]) {
  const files = fixtures.map(({ file }) => file)
  const expected: ExpectedRouteSnapshot = {}

  const addDefaultPrefix = (value: string | undefined): string | undefined => {
    if (!value || value === 'root') {
      return value
    }

    const defaultPrefix = 'routes'
    if (value.startsWith(`${defaultPrefix}/`) || value.startsWith('/')) {
      return value
    }

    return `${defaultPrefix}/${value}`
  }

  for (const { file, expectation } of fixtures) {
    if (!expectation) continue

    const { id, file: overrideFile, parentId, ...rest } = expectation
    const normalizedFile =
      overrideFile ?? `routes/${file.replace(/\\/g, '/')}`

    const resolvedId = addDefaultPrefix(id)
    const resolvedParentId = addDefaultPrefix(parentId)

    if (!resolvedId) {
      throw new Error('Expected route fixture id to be defined')
    }

    const snapshotEntry: Partial<FlattenedRouteEntry> = {
      file: normalizedFile,
      ...rest,
    }

    if (resolvedParentId) {
      snapshotEntry.parentId = resolvedParentId
    }

    expected[resolvedId] = snapshotEntry
  }

  return { files, expected }
}

export function expectRouteFixturesToMatchSnapshot(
  fixtures: RouteFixture[],
  options: autoRoutesOptions = {},
): RouteSnapshot {
  const { files, expected } = createRouteFixtures(fixtures)
  return expectFilesToMatchSnapshot(files, expected, options)
}

export function generateFlexRoutesAndVerifyResultWithExpected(
  routesWithExpectedValues: Record<string, ExpectedValues>,
) {
  const routesArrayInput = Object.keys(routesWithExpectedValues) as Array<
    keyof typeof routesWithExpectedValues
  >

  const routes = autoRoutes({
    visitFiles: visitFilesFromArray(routesArrayInput),
  })

  const flattened = normalizeRoutes(routes)

  routesArrayInput.forEach((key) => {
    const route = routesWithExpectedValues[key]
    const generated = flattened[route.id]

    expect(generated).toBeDefined()
    expect(generated?.path).toBe(route.path)
    expect(generated?.parentId).toBe(route.parentId)
  })
}
