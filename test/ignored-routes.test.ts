import {
  expectFilesToMatchSnapshot,
  ExpectedRouteSnapshot,
} from './utils/route-test-helpers'

describe('ignored routes', () => {
  const ignoredRouteFiles = ['**/.*', '**/*.css', '**/*.test.{js,jsx,ts,tsx}']

  it('should ignore routes for flat-files', () => {
    const flatFiles = [
      '$lang.$ref.tsx',
      '$lang.$ref._index.tsx',
      '$lang.$ref.$.tsx',
      '_index.tsx',
      'healthcheck.tsx',
      'style.css',
      '_index.test.tsx',
      'styles/style.css',
      '__tests__/route.test.tsx',
    ]
    const expectedRoutes: ExpectedRouteSnapshot = {
      '$lang.$ref': {
        file: 'routes/$lang.$ref.tsx',
        parentId: 'root',
        path: ':lang/:ref',
      },
      '$lang.$ref.$': {
        file: 'routes/$lang.$ref.$.tsx',
        parentId: 'routes/$lang.$ref',
        path: '*',
      },
      '$lang.$ref._index': {
        file: 'routes/$lang.$ref._index.tsx',
        index: true,
        parentId: 'routes/$lang.$ref',
      },
      _index: {
        file: 'routes/_index.tsx',
        index: true,
        parentId: 'root',
      },
      healthcheck: {
        file: 'routes/healthcheck.tsx',
        parentId: 'root',
        path: 'healthcheck',
      },
    }
    expectFilesToMatchSnapshot(flatFiles, expectedRoutes, { ignoredRouteFiles })
  })
})
