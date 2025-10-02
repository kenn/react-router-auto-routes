import {
  createRoutesFromFiles,
  expectFilesToMatchSnapshot,
  expectRoutesToMatch,
  ExpectedRouteSnapshot,
  flattenRoutesById,
} from './utils/route-test-helpers'

describe('flat folder routes', () => {
  it('should define routes for flat-folders', () => {
    const flatFolders = [
      '$lang.$ref/route.tsx',
      '$lang.$ref._index/route.tsx',
      '$lang.$ref.$/route.tsx',
      '_index/route.tsx',
      'healthcheck/route.tsx',
    ]
    const expectedRoutes: ExpectedRouteSnapshot = {
      '$lang.$ref.$/route': {
        file: 'routes/$lang.$ref.$/route.tsx',
        parentId: 'routes/$lang.$ref/route',
        path: '*',
      },
      '$lang.$ref._index/route': {
        file: 'routes/$lang.$ref._index/route.tsx',
        index: true,
        parentId: 'routes/$lang.$ref/route',
      },
      '$lang.$ref/route': {
        file: 'routes/$lang.$ref/route.tsx',
        parentId: 'root',
        path: ':lang/:ref',
      },
      '_index/route': {
        file: 'routes/_index/route.tsx',
        index: true,
        parentId: 'root',
      },
      'healthcheck/route': {
        file: 'routes/healthcheck/route.tsx',
        parentId: 'root',
        path: 'healthcheck',
      },
    }
    expectFilesToMatchSnapshot(flatFolders, expectedRoutes)
  })

  it('should define routes for flat-folders on Windows', () => {
    const flatFolders = [
      '$lang.$ref\\route.tsx',
      '$lang.$ref._index\\route.tsx',
      '$lang.$ref.$\\route.tsx',
      '_index\\route.tsx',
      'healthcheck\\route.tsx',
    ]
    const routes = createRoutesFromFiles(flatFolders)
    const lookup = flattenRoutesById(routes)
    expect(lookup['routes/$lang.$ref._index/route']).toBeDefined()
    expect(lookup['routes/$lang.$ref._index/route']?.parentId).toBe(
      'routes/$lang.$ref/route',
    )
    expect(lookup['routes/$lang.$ref._index/route']?.file).toBe(
      'routes/$lang.$ref._index/route.tsx',
    )
    const expectedRoutes: ExpectedRouteSnapshot = {
      '$lang.$ref.$/route': {
        file: 'routes/$lang.$ref.$/route.tsx',
        parentId: 'routes/$lang.$ref/route',
        path: '*',
      },
      '$lang.$ref._index/route': {
        file: 'routes/$lang.$ref._index/route.tsx',
        index: true,
        parentId: 'routes/$lang.$ref/route',
      },
      '$lang.$ref/route': {
        file: 'routes/$lang.$ref/route.tsx',
        parentId: 'root',
        path: ':lang/:ref',
      },
      '_index/route': {
        file: 'routes/_index/route.tsx',
        index: true,
        parentId: 'root',
      },
      'healthcheck/route': {
        file: 'routes/healthcheck/route.tsx',
        parentId: 'root',
        path: 'healthcheck',
      },
    }
    expectRoutesToMatch(routes, expectedRoutes)
  })

  it('should ignore non-route files in flat-folders', () => {
    const flatFolders = [
      '$lang.$ref/_layout.tsx',
      '$lang.$ref/component.tsx',
      '$lang.$ref._index/route.tsx',
      '$lang.$ref._index/style.css',
      '$lang.$ref.$/model.server.ts',
      '_index/route.tsx',
      'healthcheck/route.tsx',
    ]
    const expectedRoutes: ExpectedRouteSnapshot = {
      '$lang.$ref/component': {
        file: 'routes/$lang.$ref/component.tsx',
        parentId: 'routes/$lang.$ref/_layout',
        path: 'component',
      },
      '$lang.$ref._index/route': {
        file: 'routes/$lang.$ref._index/route.tsx',
        index: true,
        parentId: 'routes/$lang.$ref/_layout',
      },
      '$lang.$ref/_layout': {
        file: 'routes/$lang.$ref/_layout.tsx',
        parentId: 'root',
        path: ':lang/:ref',
      },
      '_index/route': {
        file: 'routes/_index/route.tsx',
        index: true,
        parentId: 'root',
      },
      'healthcheck/route': {
        file: 'routes/healthcheck/route.tsx',
        parentId: 'root',
        path: 'healthcheck',
      },
    }
    expectFilesToMatchSnapshot(flatFolders, expectedRoutes)
  })

  it('should support markdown routes as flat-folders', () => {
    const flatFolders = ['docs/_layout.tsx', 'docs/readme.route.mdx']
    const expectedRoutes: ExpectedRouteSnapshot = {
      'docs/_layout': {
        file: 'routes/docs/_layout.tsx',
        parentId: 'root',
        path: 'docs',
      },
      'docs/readme.route': {
        file: 'routes/docs/readme.route.mdx',
        parentId: 'routes/docs/_layout',
        path: 'readme',
      },
    }
    expectFilesToMatchSnapshot(flatFolders, expectedRoutes)
  })

  it('should treat nested files without special suffixes as routes', () => {
    const flatFolders = ['oauth.tsx', 'oauth/google.tsx']
    const expectedRoutes: ExpectedRouteSnapshot = {
      oauth: {
        file: 'routes/oauth.tsx',
        parentId: 'root',
        path: 'oauth',
      },
      'oauth/google': {
        file: 'routes/oauth/google.tsx',
        parentId: 'routes/oauth',
        path: 'google',
      },
    }

    expectFilesToMatchSnapshot(flatFolders, expectedRoutes)
  })
})
