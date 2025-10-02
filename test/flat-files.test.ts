import { expectFilesToMatchSnapshot, ExpectedRouteSnapshot } from './utils/route-test-helpers'

describe('flat file routes', () => {
  it('should define routes for flat-files', () => {
    const flatFiles = [
      '$lang.$ref.tsx',
      '$lang.$ref._index.tsx',
      '$lang.$ref.$.tsx',
      '_index.tsx',
      'healthcheck.tsx',
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
    expectFilesToMatchSnapshot(flatFiles, expectedRoutes)
  })

  it('should support markdown routes as flat-files', () => {
    const flatFiles = ['docs.tsx', 'docs.readme.md']
    const expectedRoutes: ExpectedRouteSnapshot = {
      docs: {
        file: 'routes/docs.tsx',
        parentId: 'root',
        path: 'docs',
      },
      'docs.readme': {
        file: 'routes/docs.readme.md',
        parentId: 'routes/docs',
        path: 'readme',
      },
    }
    expectFilesToMatchSnapshot(flatFiles, expectedRoutes)
  })
})
