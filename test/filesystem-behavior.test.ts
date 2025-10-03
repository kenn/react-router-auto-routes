import {
  createRoutesFromFiles,
  expectFilesToMatchSnapshot,
  expectRoutesToMatch,
  ExpectedRouteSnapshot,
  flattenRoutesById,
} from './utils/route-test-helpers'

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

describe('folder normalization', () => {
  it('should treat nested folders without parents as dot notation', () => {
    const files = ['oauth/google.ts', 'oauth/logout.ts']
    const routes = createRoutesFromFiles(files)

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

    expect(routes).toHaveLength(1)
    expect(routes[0].id).toBe('routes/oauth')
    expect(routes[0].file).toBe('routes/oauth.tsx')
    expect(routes[0].children).toHaveLength(1)
    expect(routes[0].children?.[0].path).toBe('google')
  })

  it('should handle deeply nested folders without parents', () => {
    const files = ['api/v1/users.ts', 'api/v1/posts.ts']
    const routes = createRoutesFromFiles(files)

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

    expect(routes).toHaveLength(1)
    expect(routes[0].id).toBe('routes/dashboard/_layout')
    expect(routes[0].children).toHaveLength(1)
    expect(routes[0].children?.[0].index).toBe(true)
  })
})

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

describe('prefix-based colocation with + folders', () => {
  it('should ignore files in anonymous colocation folder +/', () => {
    const files = [
      'dashboard/index.tsx',
      'dashboard/+/utils.ts',
      'dashboard/+/helpers.ts',
    ]
    const expectedRoutes: ExpectedRouteSnapshot = {
      'dashboard/index': {
        file: 'routes/dashboard/index.tsx',
        index: true,
        parentId: 'root',
        path: 'dashboard',
      },
    }

    expectFilesToMatchSnapshot(files, expectedRoutes)
  })

  it('should ignore files in named colocation folders +components/, +lib/', () => {
    const files = [
      'dashboard/index.tsx',
      'dashboard/+components/avatar.tsx',
      'dashboard/+lib/api.ts',
    ]
    const expectedRoutes: ExpectedRouteSnapshot = {
      'dashboard/index': {
        file: 'routes/dashboard/index.tsx',
        index: true,
        parentId: 'root',
        path: 'dashboard',
      },
    }

    expectFilesToMatchSnapshot(files, expectedRoutes)
  })

  it('should ignore nested folders in colocation folders', () => {
    const files = [
      'dashboard/index.tsx',
      'dashboard/+/utils/format.ts',
      'dashboard/+components/buttons/button.tsx',
    ]
    const expectedRoutes: ExpectedRouteSnapshot = {
      'dashboard/index': {
        file: 'routes/dashboard/index.tsx',
        index: true,
        parentId: 'root',
        path: 'dashboard',
      },
    }

    expectFilesToMatchSnapshot(files, expectedRoutes)
  })
})

describe('prefix-based colocation with + files', () => {
  it('should ignore files starting with +', () => {
    const files = [
      'dashboard/index.tsx',
      'dashboard/+utils.ts',
      'dashboard/+types.ts',
    ]
    const expectedRoutes: ExpectedRouteSnapshot = {
      'dashboard/index': {
        file: 'routes/dashboard/index.tsx',
        index: true,
        parentId: 'root',
        path: 'dashboard',
      },
    }

    expectFilesToMatchSnapshot(files, expectedRoutes)
  })

  it('should ignore a file named +.ts inside a route folder', () => {
    const files = ['dashboard/index.tsx', 'dashboard/+.ts']
    const expectedRoutes: ExpectedRouteSnapshot = {
      'dashboard/index': {
        file: 'routes/dashboard/index.tsx',
        index: true,
        parentId: 'root',
        path: 'dashboard',
      },
    }

    expectFilesToMatchSnapshot(files, expectedRoutes)
  })

  it('should treat + in middle of filename as normal route', () => {
    const files = ['users+admins.tsx']
    const expectedRoutes: ExpectedRouteSnapshot = {
      'users+admins': {
        file: 'routes/users+admins.tsx',
        parentId: 'root',
        path: 'users+admins',
      },
    }

    expectFilesToMatchSnapshot(files, expectedRoutes)
  })
})

describe('prefix colocation error cases', () => {
  it('should throw error for root-level + folder', () => {
    const files = ['+/utils.ts']
    expect(() => createRoutesFromFiles(files)).toThrowError(
      "Colocation entries must live inside a route folder. Move '+/utils.ts' under an actual route directory.",
    )
  })

  it('should throw error for root-level + file', () => {
    const files = ['+utils.ts']
    expect(() => createRoutesFromFiles(files)).toThrowError(
      "Colocation entries must live inside a route folder. Move '+utils.ts' under an actual route directory.",
    )
  })

  it('should throw error for nested anonymous folders +/+/', () => {
    const files = ['dashboard/+/+/utils.ts']
    expect(() => createRoutesFromFiles(files)).toThrowError(
      'Nested anonymous colocation folders (+/+/) are not allowed. Use named folders like +/components/ instead. Found in: dashboard/+/+/utils.ts',
    )
  })

  it('should throw error for root-level named + folder', () => {
    const files = ['+lib/utils.ts']
    expect(() => createRoutesFromFiles(files)).toThrowError(
      "Colocation entries must live inside a route folder. Move '+lib/utils.ts' under an actual route directory.",
    )
  })
})

describe('prefix colocation integration tests', () => {
  it('should handle both folder and file prefix patterns', () => {
    const files = [
      'dashboard/index.tsx',
      'dashboard/+utils.ts',
      'dashboard/+/helpers.ts',
      'dashboard/+lib/api.ts',
    ]
    const expectedRoutes: ExpectedRouteSnapshot = {
      'dashboard/index': {
        file: 'routes/dashboard/index.tsx',
        index: true,
        parentId: 'root',
        path: 'dashboard',
      },
    }

    expectFilesToMatchSnapshot(files, expectedRoutes)
  })

  it('should handle complex route structure', () => {
    const files = [
      '_index.tsx',
      'users.$userId.tsx',
      'users.$userId/+avatar.tsx',
      'users.$userId/+/utils.ts',
      'users.$userId/+components/form.tsx',
      'users.$userId.edit.tsx',
    ]
    const expectedRoutes: ExpectedRouteSnapshot = {
      _index: {
        file: 'routes/_index.tsx',
        index: true,
        parentId: 'root',
      },
      'users.$userId': {
        file: 'routes/users.$userId.tsx',
        parentId: 'root',
        path: 'users/:userId',
      },
      'users.$userId.edit': {
        file: 'routes/users.$userId.edit.tsx',
        parentId: 'routes/users.$userId',
        path: 'edit',
      },
    }

    expectFilesToMatchSnapshot(files, expectedRoutes)
  })

  it('should work with Windows path separators (backslashes)', () => {
    const files = [
      'dashboard\\index.tsx',
      'dashboard\\+utils.ts',
      'dashboard\\+\\helpers.ts',
      'dashboard\\+components\\chart.tsx',
    ]
    const expectedRoutes: ExpectedRouteSnapshot = {
      'dashboard/index': {
        file: 'routes/dashboard/index.tsx',
        index: true,
        parentId: 'root',
        path: 'dashboard',
      },
    }

    expectFilesToMatchSnapshot(files, expectedRoutes)
  })
})

describe('custom prefix character', () => {
  it('should respect colocateChar overrides', () => {
    const files = [
      'dashboard/index.tsx',
      'dashboard/_utils.ts',
      'dashboard/_/helpers.ts',
    ]
    const expectedRoutes: ExpectedRouteSnapshot = {
      'dashboard/index': {
        file: 'routes/dashboard/index.tsx',
        index: true,
        parentId: 'root',
        path: 'dashboard',
      },
    }

    expectFilesToMatchSnapshot(files, expectedRoutes, { colocateChar: '_' })
  })
})

describe('custom prefix character edge cases', () => {
  it('should throw root-level error when colocateChar overrides to _', () => {
    const files = ['_utils.ts']
    expect(() =>
      createRoutesFromFiles(files, { colocateChar: '_' }),
    ).toThrowError(
      "Colocation entries must live inside a route folder. Move '_utils.ts' under an actual route directory.",
    )
  })

  it('should throw nested anonymous error when colocateChar overrides to _', () => {
    const files = ['dashboard/_/_/helpers.ts']
    expect(() =>
      createRoutesFromFiles(files, { colocateChar: '_' }),
    ).toThrowError(
      'Nested anonymous colocation folders (+/+/) are not allowed. Use named folders like +/components/ instead. Found in: dashboard/_/_/helpers.ts',
    )
  })

  it('should treat + files as routes when colocateChar is _', () => {
    const files = ['dashboard/index.tsx', '+utils.ts']
    const expectedRoutes: ExpectedRouteSnapshot = {
      'dashboard/index': {
        file: 'routes/dashboard/index.tsx',
        index: true,
        parentId: 'root',
        path: 'dashboard',
      },
      '+utils': {
        file: 'routes/+utils.ts',
        parentId: 'root',
        path: '+utils',
      },
    }

    expectFilesToMatchSnapshot(files, expectedRoutes, { colocateChar: '_' })
  })
})
