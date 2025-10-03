import {
  createRouteFixtures,
  createRoutesFromFiles,
  expectFilesToMatchSnapshot,
  expectRoutesToMatch,
  fileOnly,
  flattenRoutesById,
  route,
} from './utils/route-test-helpers'

describe('flat file routes', () => {
  it('should define routes for flat-files', () => {
    const { files, expected } = createRouteFixtures([
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
    ])

    expectFilesToMatchSnapshot(files, expected)
  })

  it('should support markdown routes as flat-files', () => {
    const { files, expected } = createRouteFixtures([
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

    expectFilesToMatchSnapshot(files, expected)
  })
})

describe('flat folder routes', () => {
  it('should define routes for flat-folders', () => {
    const { files, expected } = createRouteFixtures([
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
    ])

    expectFilesToMatchSnapshot(files, expected)
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
    const { files, expected } = createRouteFixtures([
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

    expectFilesToMatchSnapshot(files, expected)
  })

  it('should support markdown routes as flat-folders', () => {
    const { files, expected } = createRouteFixtures([
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

    expectFilesToMatchSnapshot(files, expected)
  })

  it('should treat nested files without special suffixes as routes', () => {
    const { files, expected } = createRouteFixtures([
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

    expectFilesToMatchSnapshot(files, expected)
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
    const { files, expected } = createRouteFixtures([
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
      fileOnly('style.css'),
      fileOnly('_index.test.tsx'),
      fileOnly('styles/style.css'),
      fileOnly('__tests__/route.test.tsx'),
    ])

    expectFilesToMatchSnapshot(files, expected, { ignoredRouteFiles })
  })
})

describe('prefix-based colocation with + folders', () => {
  it('should ignore files in anonymous colocation folder +/', () => {
    const { files, expected } = createRouteFixtures([
      route('dashboard/index.tsx', {
        id: 'dashboard/index',
        parentId: 'root',
        path: 'dashboard',
        index: true,
      }),
      fileOnly('dashboard/+/utils.ts'),
      fileOnly('dashboard/+/helpers.ts'),
    ])

    expectFilesToMatchSnapshot(files, expected)
  })

  it('should ignore files in named colocation folders +components/, +lib/', () => {
    const { files, expected } = createRouteFixtures([
      route('dashboard/index.tsx', {
        id: 'dashboard/index',
        parentId: 'root',
        path: 'dashboard',
        index: true,
      }),
      fileOnly('dashboard/+components/avatar.tsx'),
      fileOnly('dashboard/+lib/api.ts'),
    ])

    expectFilesToMatchSnapshot(files, expected)
  })

  it('should ignore nested folders in colocation folders', () => {
    const { files, expected } = createRouteFixtures([
      route('dashboard/index.tsx', {
        id: 'dashboard/index',
        parentId: 'root',
        path: 'dashboard',
        index: true,
      }),
      fileOnly('dashboard/+/utils/format.ts'),
      fileOnly('dashboard/+components/buttons/button.tsx'),
    ])

    expectFilesToMatchSnapshot(files, expected)
  })
})

describe('prefix-based colocation with + files', () => {
  it('should ignore files starting with +', () => {
    const { files, expected } = createRouteFixtures([
      route('dashboard/index.tsx', {
        id: 'dashboard/index',
        parentId: 'root',
        path: 'dashboard',
        index: true,
      }),
      fileOnly('dashboard/+utils.ts'),
      fileOnly('dashboard/+types.ts'),
    ])

    expectFilesToMatchSnapshot(files, expected)
  })

  it('should ignore a file named +.ts inside a route folder', () => {
    const { files, expected } = createRouteFixtures([
      route('dashboard/index.tsx', {
        id: 'dashboard/index',
        parentId: 'root',
        path: 'dashboard',
        index: true,
      }),
      fileOnly('dashboard/+.ts'),
    ])

    expectFilesToMatchSnapshot(files, expected)
  })

  it('should treat + in middle of filename as normal route', () => {
    const { files, expected } = createRouteFixtures([
      route('users+admins.tsx', {
        id: 'users+admins',
        parentId: 'root',
        path: 'users+admins',
      }),
    ])

    expectFilesToMatchSnapshot(files, expected)
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
    const { files, expected } = createRouteFixtures([
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

    expectFilesToMatchSnapshot(files, expected)
  })

  it('should handle complex route structure', () => {
    const { files, expected } = createRouteFixtures([
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

    expectFilesToMatchSnapshot(files, expected)
  })

  it('should work with Windows path separators (backslashes)', () => {
    const { files, expected } = createRouteFixtures([
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

    expectFilesToMatchSnapshot(files, expected)
  })
})

describe('custom prefix character', () => {
  it('should respect colocateChar overrides', () => {
    const { files, expected } = createRouteFixtures([
      route('dashboard/index.tsx', {
        id: 'dashboard/index',
        parentId: 'root',
        path: 'dashboard',
        index: true,
      }),
      fileOnly('dashboard/_utils.ts'),
      fileOnly('dashboard/_/helpers.ts'),
    ])

    expectFilesToMatchSnapshot(files, expected, { colocateChar: '_' })
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
    const { files, expected } = createRouteFixtures([
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
    ])

    expectFilesToMatchSnapshot(files, expected, { colocateChar: '_' })
  })
})
