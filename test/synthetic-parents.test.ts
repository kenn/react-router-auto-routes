import { createRoutesFromFiles } from './utils/route-test-helpers'

describe('synthetic parent routes', () => {
  it('should create synthetic parent for nested folder routes without explicit parent', () => {
    const files = ['api/users.ts', 'api/posts.ts']
    const routes = createRoutesFromFiles(files)

    // Should create a synthetic 'api' parent route
    expect(routes).toHaveLength(1)
    expect(routes[0].id).toBe('routes/api')
    expect(routes[0].path).toBe('api')
    expect(routes[0].file).toBeUndefined() // Synthetic route has no file
    expect(routes[0].children).toHaveLength(2)

    const usersRoute = routes[0].children?.find(r => r.id === 'routes/api/users')
    expect(usersRoute).toBeDefined()
    expect(usersRoute?.file).toBe('routes/api/users.ts')
    expect(usersRoute?.path).toBe('users')

    const postsRoute = routes[0].children?.find(r => r.id === 'routes/api/posts')
    expect(postsRoute).toBeDefined()
    expect(postsRoute?.file).toBe('routes/api/posts.ts')
    expect(postsRoute?.path).toBe('posts')
  })

  it('should not create synthetic parent when explicit parent exists', () => {
    const files = ['api.tsx', 'api/users.ts']
    const routes = createRoutesFromFiles(files)

    // Should use the explicit api.tsx parent
    expect(routes).toHaveLength(1)
    expect(routes[0].id).toBe('routes/api')
    expect(routes[0].file).toBe('routes/api.tsx') // Has a real file
    expect(routes[0].children).toHaveLength(1)
  })

  it('should create synthetic parents for deeply nested routes', () => {
    const files = ['api/v1/users.ts', 'api/v1/posts.ts']
    const routes = createRoutesFromFiles(files)

    // Should create synthetic 'api' and 'api/v1' parents
    expect(routes).toHaveLength(1)
    expect(routes[0].id).toBe('routes/api')
    expect(routes[0].file).toBeUndefined()
    expect(routes[0].children).toHaveLength(1)

    const v1Route = routes[0].children?.[0]
    expect(v1Route?.id).toBe('routes/api/v1')
    expect(v1Route?.file).toBeUndefined()
    expect(v1Route?.children).toHaveLength(2)
  })

  it('should not create synthetic parents for dot notation routes', () => {
    const files = ['app.users.tsx', 'app.posts.tsx']
    const routes = createRoutesFromFiles(files)

    // Both routes should be at root level (no synthetic parent)
    expect(routes).toHaveLength(2)
    expect(routes[0].file).toBe('routes/app.users.tsx')
    expect(routes[0].path).toBe('app/users')
    expect(routes[1].file).toBe('routes/app.posts.tsx')
    expect(routes[1].path).toBe('app/posts')
  })

  it('should not create synthetic parent for mixed dot and folder notation', () => {
    const files = ['app.$id.edit.tsx']
    const routes = createRoutesFromFiles(files)

    // Should be at root level (dot notation takes precedence)
    expect(routes).toHaveLength(1)
    expect(routes[0].file).toBe('routes/app.$id.edit.tsx')
    expect(routes[0].path).toBe('app/:id/edit')
  })
})
