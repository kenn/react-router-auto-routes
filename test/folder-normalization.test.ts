import { createRoutesFromFiles } from './utils/route-test-helpers'

describe('folder normalization', () => {
  it('should treat nested folders without parents as dot notation', () => {
    const files = ['oauth/google.ts', 'oauth/logout.ts']
    const routes = createRoutesFromFiles(files)

    // Should create routes at root level with full paths
    expect(routes).toHaveLength(2)

    const googleRoute = routes.find(r => r.id === 'routes/oauth/google')
    expect(googleRoute).toBeDefined()
    expect(googleRoute?.file).toBe('routes/oauth/google.ts')
    expect(googleRoute?.path).toBe('oauth/google')
    expect(googleRoute?.children).toBeUndefined()

    const logoutRoute = routes.find(r => r.id === 'routes/oauth/logout')
    expect(logoutRoute).toBeDefined()
    expect(logoutRoute?.file).toBe('routes/oauth/logout.ts')
    expect(logoutRoute?.path).toBe('oauth/logout')
  })

  it('should not flatten when explicit parent exists', () => {
    const files = ['oauth.tsx', 'oauth/google.ts']
    const routes = createRoutesFromFiles(files)

    // Should nest under the explicit parent
    expect(routes).toHaveLength(1)
    expect(routes[0].id).toBe('routes/oauth')
    expect(routes[0].file).toBe('routes/oauth.tsx')
    expect(routes[0].children).toHaveLength(1)
    expect(routes[0].children?.[0].path).toBe('google')
  })

  it('should handle deeply nested folders without parents', () => {
    const files = ['api/v1/users.ts', 'api/v1/posts.ts']
    const routes = createRoutesFromFiles(files)

    // Should flatten to root with full paths
    expect(routes).toHaveLength(2)

    const usersRoute = routes.find(r => r.id === 'routes/api/v1/users')
    expect(usersRoute).toBeDefined()
    expect(usersRoute?.path).toBe('api/v1/users')

    const postsRoute = routes.find(r => r.id === 'routes/api/v1/posts')
    expect(postsRoute).toBeDefined()
    expect(postsRoute?.path).toBe('api/v1/posts')
  })

  it('should not flatten routes that already use dot notation', () => {
    const files = ['api.users.ts']
    const routes = createRoutesFromFiles(files)

    expect(routes).toHaveLength(1)
    expect(routes[0].path).toBe('api/users')
  })

  it('should not flatten index routes', () => {
    const files = ['dashboard/_layout.tsx', 'dashboard/projects/$id/index.tsx']
    const routes = createRoutesFromFiles(files)

    // Index route should still nest under layout
    expect(routes).toHaveLength(1)
    expect(routes[0].id).toBe('routes/dashboard/_layout')
    expect(routes[0].children).toHaveLength(1)
    expect(routes[0].children?.[0].index).toBe(true)
  })
})
