import {
  ExpectedValues,
  generateFlexRoutesAndVerifyResultWithExpected,
} from './utils/route-test-helpers'

describe('special character escaping', () => {
  it('should escape underscore', () => {
    const routesWithExpectedValues: Record<string, ExpectedValues> = {
      '[__].tsx': {
        id: 'routes/[__]',
        path: '__',
        parentId: 'root',
      },
      '[_].tsx': {
        id: 'routes/[_]',
        path: '_',
        parentId: 'root',
      },
      '_layout.[___]/index.tsx': {
        id: 'routes/_layout.[___]/index',
        path: '___',
        parentId: 'root',
      },
      '_layout.parent.[__]/index.tsx': {
        id: 'routes/_layout.parent.[__]/index',
        path: 'parent/__',
        parentId: 'root',
      },
    }

    generateFlexRoutesAndVerifyResultWithExpected(routesWithExpectedValues)
  })
})
