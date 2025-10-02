import {
  expectFilesToMatchSnapshot,
  ExpectedRouteSnapshot,
} from './utils/route-test-helpers'

describe('hybrid routes', () => {
  it('should define routes for hybrid routes', () => {
    const flatFolders = [
      '_index/route.tsx',
      '_public/_layout.tsx',
      '_public/about/route.tsx',
      '_public/contact[.jpg]/route.tsx',
      'test.$/route.tsx',
      'users/_layout.tsx',
      'users/users.css',
      'users/route/route.tsx',
      'users/$userId/route.tsx',
      'users/$userId/avatar.png',
      'users/$userId_.edit/route.tsx',
    ]
    const expectedRoutes: ExpectedRouteSnapshot = {
      '_index/route': {
        file: 'routes/_index/route.tsx',
        index: true,
        parentId: 'root',
      },
      '_public/_layout': {
        file: 'routes/_public/_layout.tsx',
        parentId: 'root',
      },
      '_public/about/route': {
        file: 'routes/_public/about/route.tsx',
        parentId: 'routes/_public/_layout',
        path: 'about',
      },
      '_public/contact[.jpg]/route': {
        file: 'routes/_public/contact[.jpg]/route.tsx',
        parentId: 'routes/_public/_layout',
        path: 'contact.jpg',
      },
      'test.$/route': {
        file: 'routes/test.$/route.tsx',
        parentId: 'root',
        path: 'test/*',
      },
      'users/$userId/route': {
        file: 'routes/users/$userId/route.tsx',
        parentId: 'routes/users/route/route',
        path: ':userId',
      },
      'users/$userId_.edit/route': {
        file: 'routes/users/$userId_.edit/route.tsx',
        parentId: 'routes/users/route/route',
        path: ':userId/edit',
      },
      'users/_layout': {
        file: 'routes/users/_layout.tsx',
        parentId: 'root',
        path: 'users',
      },
      'users/route/route': {
        file: 'routes/users/route/route.tsx',
        parentId: 'root',
        path: 'users',
      },
    }
    expectFilesToMatchSnapshot(flatFolders, expectedRoutes)
  })
})
