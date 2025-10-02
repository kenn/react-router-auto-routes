import {
  ExpectedRouteSnapshot,
  expectFilesToMatchSnapshot,
} from './utils/route-test-helpers'

describe('layout and index nesting', () => {
  it('should properly nest index routes under layouts', () => {
    const files = [
      'dashboard/_layout.tsx',
      'dashboard/index.tsx',
      'settings/_layout.tsx',
      'settings/index.tsx',
    ]

    const expectedRoutes: ExpectedRouteSnapshot = {
      'dashboard/_layout': {
        file: 'routes/dashboard/_layout.tsx',
        parentId: 'root',
        path: 'dashboard',
      },
      'dashboard/index': {
        file: 'routes/dashboard/index.tsx',
        index: true,
        parentId: 'routes/dashboard/_layout',
      },
      'settings/_layout': {
        file: 'routes/settings/_layout.tsx',
        parentId: 'root',
        path: 'settings',
      },
      'settings/index': {
        file: 'routes/settings/index.tsx',
        index: true,
        parentId: 'routes/settings/_layout',
      },
    }

    expectFilesToMatchSnapshot(files, expectedRoutes)
  })

  it('should handle deeply nested routes with layouts', () => {
    const files = [
      'dashboard/_layout.tsx',
      'dashboard/projects/_layout.tsx',
      'dashboard/projects/$id/index.tsx',
      'dashboard/projects/$id/$section/index.tsx',
    ]

    const expectedRoutes: ExpectedRouteSnapshot = {
      'dashboard/_layout': {
        file: 'routes/dashboard/_layout.tsx',
        parentId: 'root',
        path: 'dashboard',
      },
      'dashboard/projects/_layout': {
        file: 'routes/dashboard/projects/_layout.tsx',
        parentId: 'routes/dashboard/_layout',
        path: 'projects',
      },
      'dashboard/projects/$id/index': {
        file: 'routes/dashboard/projects/$id/index.tsx',
        index: true,
        parentId: 'routes/dashboard/projects/_layout',
        path: ':id',
      },
      'dashboard/projects/$id/$section/index': {
        file: 'routes/dashboard/projects/$id/$section/index.tsx',
        index: true,
        parentId: 'routes/dashboard/projects/_layout',
        path: ':id/:section',
      },
    }

    expectFilesToMatchSnapshot(files, expectedRoutes)
  })
})
