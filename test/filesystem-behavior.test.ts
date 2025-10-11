import {
  createRouteFixtures,
  createRoutesFromFiles,
  expectRouteFixturesToMatchSnapshot,
  expectRoutesToMatch,
  fileOnly,
  flattenRoutesById,
  route,
} from './utils/route-test-helpers'
import type { RouteFixture } from './utils/route-test-helpers'

const createFlatFileFixtures = (): RouteFixture[] => [
  route('$lang.$ref.tsx', {
    id: '$lang.$ref',
    parentId: 'root',
    path: ':lang/:ref',
  }),
  route('$lang.$ref._index.tsx', {
    id: '$lang.$ref._index',
    parentId: 'routes/$lang.$ref',
    index: true,
  }),
  route('$lang.$ref.$.tsx', {
    id: '$lang.$ref.$',
    parentId: 'routes/$lang.$ref',
    path: '*',
  }),
  route('_index.tsx', {
    id: '_index',
    parentId: 'root',
    index: true,
  }),
  route('healthcheck.tsx', {
    id: 'healthcheck',
    parentId: 'root',
    path: 'healthcheck',
  }),
]

const createFlatFolderFixtures = (): RouteFixture[] => [
  route('$lang.$ref/route.tsx', {
    id: '$lang.$ref/route',
    parentId: 'root',
    path: ':lang/:ref',
  }),
  route('$lang.$ref._index/route.tsx', {
    id: '$lang.$ref._index/route',
    parentId: 'routes/$lang.$ref/route',
    index: true,
  }),
  route('$lang.$ref.$/route.tsx', {
    id: '$lang.$ref.$/route',
    parentId: 'routes/$lang.$ref/route',
    path: '*',
  }),
  route('_index/route.tsx', {
    id: '_index/route',
    parentId: 'root',
    index: true,
  }),
  route('healthcheck/route.tsx', {
    id: 'healthcheck/route',
    parentId: 'root',
    path: 'healthcheck',
  }),
]

const withDashboardIndex = (...fixtures: RouteFixture[]): RouteFixture[] => [
  route('dashboard/index.tsx', {
    id: 'dashboard/index',
    parentId: 'root',
    path: 'dashboard',
    index: true,
  }),
  ...fixtures,
]

describe('flat file routes', () => {
  it('should define routes for flat-files', () => {
    expectRouteFixturesToMatchSnapshot(createFlatFileFixtures())
  })

  it('should support markdown routes as flat-files', () => {
    expectRouteFixturesToMatchSnapshot([
      route('docs.tsx', {
        id: 'docs',
        parentId: 'root',
        path: 'docs',
      }),
      route('docs.readme.md', {
        id: 'docs.readme',
        parentId: 'routes/docs',
        path: 'readme',
      }),
    ])
  })
})

describe('flat folder routes', () => {
  it('should define routes for flat-folders', () => {
    expectRouteFixturesToMatchSnapshot(createFlatFolderFixtures())
  })

  it('should define routes for flat-folders on Windows', () => {
    const { files, expected } = createRouteFixtures([
      route('$lang.$ref\\route.tsx', {
        id: '$lang.$ref/route',
        parentId: 'root',
        path: ':lang/:ref',
      }),
      route('$lang.$ref._index\\route.tsx', {
        id: '$lang.$ref._index/route',
        parentId: 'routes/$lang.$ref/route',
        index: true,
      }),
      route('$lang.$ref.$\\route.tsx', {
        id: '$lang.$ref.$/route',
        parentId: 'routes/$lang.$ref/route',
        path: '*',
      }),
      route('_index\\route.tsx', {
        id: '_index/route',
        parentId: 'root',
        index: true,
      }),
      route('healthcheck\\route.tsx', {
        id: 'healthcheck/route',
        parentId: 'root',
        path: 'healthcheck',
      }),
    ])

    const routes = createRoutesFromFiles(files)
    const lookup = flattenRoutesById(routes)
    expect(lookup['routes/$lang.$ref._index/route']).toBeDefined()
    expect(lookup['routes/$lang.$ref._index/route']?.parentId).toBe(
      'routes/$lang.$ref/route',
    )
    expect(lookup['routes/$lang.$ref._index/route']?.file).toBe(
      'routes/$lang.$ref._index/route.tsx',
    )
    expectRoutesToMatch(routes, expected)
  })

  it('should ignore non-route files in flat-folders', () => {
    expectRouteFixturesToMatchSnapshot([
      route('$lang.$ref/_layout.tsx', {
        id: '$lang.$ref/_layout',
        parentId: 'root',
        path: ':lang/:ref',
      }),
      route('$lang.$ref/component.tsx', {
        id: '$lang.$ref/component',
        parentId: 'routes/$lang.$ref/_layout',
        path: 'component',
      }),
      route('$lang.$ref._index/route.tsx', {
        id: '$lang.$ref._index/route',
        parentId: 'routes/$lang.$ref/_layout',
        index: true,
      }),
      fileOnly('$lang.$ref._index/style.css'),
      fileOnly('$lang.$ref.$/model.server.ts'),
      route('_index/route.tsx', {
        id: '_index/route',
        parentId: 'root',
        index: true,
      }),
      route('healthcheck/route.tsx', {
        id: 'healthcheck/route',
        parentId: 'root',
        path: 'healthcheck',
      }),
    ])
  })

  it('should support markdown routes as flat-folders', () => {
    expectRouteFixturesToMatchSnapshot([
      route('docs/_layout.tsx', {
        id: 'docs/_layout',
        parentId: 'root',
        path: 'docs',
      }),
      route('docs/readme.route.mdx', {
        id: 'docs/readme.route',
        parentId: 'routes/docs/_layout',
        path: 'readme',
      }),
    ])
  })

  it('should treat nested files without special suffixes as routes', () => {
    expectRouteFixturesToMatchSnapshot([
      route('oauth.tsx', {
        id: 'oauth',
        parentId: 'root',
        path: 'oauth',
      }),
      route('oauth/google.tsx', {
        id: 'oauth/google',
        parentId: 'routes/oauth',
        path: 'google',
      }),
    ])
  })
})

describe('folder normalization', () => {
  it('should treat nested folders without parents as dot notation', () => {
    const files = ['oauth/google.ts', 'oauth/logout.ts']
    const routes = createRoutesFromFiles(files)

    expect(routes).toHaveLength(2)

    const googleRoute = routes.find((r) => r.id === 'routes/oauth/google')
    expect(googleRoute).toBeDefined()
    expect(googleRoute?.file).toBe('routes/oauth/google.ts')
    expect(googleRoute?.path).toBe('oauth/google')
    expect(googleRoute?.children).toBeUndefined()

    const logoutRoute = routes.find((r) => r.id === 'routes/oauth/logout')
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

    const usersRoute = routes.find((r) => r.id === 'routes/api/v1/users')
    expect(usersRoute).toBeDefined()
    expect(usersRoute?.path).toBe('api/v1/users')

    const postsRoute = routes.find((r) => r.id === 'routes/api/v1/posts')
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
    expectRouteFixturesToMatchSnapshot(
      [
        ...createFlatFileFixtures(),
        fileOnly('style.css'),
        fileOnly('_index.test.tsx'),
        fileOnly('styles/style.css'),
        fileOnly('__tests__/route.test.tsx'),
      ],
      { ignoredRouteFiles },
    )
  })
})

describe('prefix-based colocation with + folders', () => {
  it('should ignore files in anonymous colocation folder +/', () => {
    expectRouteFixturesToMatchSnapshot(
      withDashboardIndex(
        fileOnly('dashboard/+/utils.ts'),
        fileOnly('dashboard/+/helpers.ts'),
      ),
    )
  })

  it('should ignore files in named colocation folders +components/, +lib/', () => {
    expectRouteFixturesToMatchSnapshot(
      withDashboardIndex(
        fileOnly('dashboard/+components/avatar.tsx'),
        fileOnly('dashboard/+lib/api.ts'),
      ),
    )
  })

  it('should ignore nested folders in colocation folders', () => {
    expectRouteFixturesToMatchSnapshot(
      withDashboardIndex(
        fileOnly('dashboard/+/utils/format.ts'),
        fileOnly('dashboard/+components/buttons/button.tsx'),
      ),
    )
  })
})

describe('prefix-based colocation with + files', () => {
  it('should ignore files starting with +', () => {
    expectRouteFixturesToMatchSnapshot(
      withDashboardIndex(
        fileOnly('dashboard/+utils.ts'),
        fileOnly('dashboard/+types.ts'),
      ),
    )
  })

  it('should ignore a file named +.ts inside a route folder', () => {
    expectRouteFixturesToMatchSnapshot(
      withDashboardIndex(fileOnly('dashboard/+.ts')),
    )
  })

  it('should treat + in middle of filename as normal route', () => {
    expectRouteFixturesToMatchSnapshot([
      route('users+admins.tsx', {
        id: 'users+admins',
        parentId: 'root',
        path: 'users+admins',
      }),
    ])
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
    expectRouteFixturesToMatchSnapshot([
      route('dashboard/index.tsx', {
        id: 'dashboard/index',
        parentId: 'root',
        path: 'dashboard',
        index: true,
      }),
      fileOnly('dashboard/+utils.ts'),
      fileOnly('dashboard/+/helpers.ts'),
      fileOnly('dashboard/+lib/api.ts'),
    ])
  })

  it('should handle complex route structure', () => {
    expectRouteFixturesToMatchSnapshot([
      route('_index.tsx', {
        id: '_index',
        parentId: 'root',
        index: true,
      }),
      route('users.$userId.tsx', {
        id: 'users.$userId',
        parentId: 'root',
        path: 'users/:userId',
      }),
      fileOnly('users.$userId/+avatar.tsx'),
      fileOnly('users.$userId/+/utils.ts'),
      fileOnly('users.$userId/+components/form.tsx'),
      route('users.$userId.edit.tsx', {
        id: 'users.$userId.edit',
        parentId: 'routes/users.$userId',
        path: 'edit',
      }),
    ])
  })

  it('should work with Windows path separators (backslashes)', () => {
    expectRouteFixturesToMatchSnapshot([
      route('dashboard\\index.tsx', {
        id: 'dashboard/index',
        parentId: 'root',
        path: 'dashboard',
        index: true,
      }),
      fileOnly('dashboard\\+utils.ts'),
      fileOnly('dashboard\\+\\helpers.ts'),
      fileOnly('dashboard\\+components\\chart.tsx'),
    ])
  })
})

describe('custom prefix character', () => {
  it('should respect colocationChar overrides', () => {
    expectRouteFixturesToMatchSnapshot(
      [
        route('dashboard/index.tsx', {
          id: 'dashboard/index',
          parentId: 'root',
          path: 'dashboard',
          index: true,
        }),
        fileOnly('dashboard/_utils.ts'),
        fileOnly('dashboard/_/helpers.ts'),
      ],
      { colocationChar: '_' },
    )
  })
})

describe('custom prefix character edge cases', () => {
  it('should throw root-level error when colocationChar overrides to _', () => {
    const files = ['_utils.ts']
    expect(() =>
      createRoutesFromFiles(files, { colocationChar: '_' }),
    ).toThrowError(
      "Colocation entries must live inside a route folder. Move '_utils.ts' under an actual route directory.",
    )
  })

  it('should throw nested anonymous error when colocationChar overrides to _', () => {
    const files = ['dashboard/_/_/helpers.ts']
    expect(() =>
      createRoutesFromFiles(files, { colocationChar: '_' }),
    ).toThrowError(
      'Nested anonymous colocation folders (+/+/) are not allowed. Use named folders like +/components/ instead. Found in: dashboard/_/_/helpers.ts',
    )
  })

  it('should treat + files as routes when colocationChar is _', () => {
    expectRouteFixturesToMatchSnapshot(
      [
        route('dashboard/index.tsx', {
          id: 'dashboard/index',
          parentId: 'root',
          path: 'dashboard',
          index: true,
        }),
        route('+utils.ts', {
          id: '+utils',
          parentId: 'root',
          path: '+utils',
        }),
      ],
      { colocationChar: '_' },
    )
  })
})
