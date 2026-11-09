import {
  createRoutesFromFiles,
  expectRoutes,
  flatFileRoutes,
  flatFolderRoutes,
  type RouteRow,
} from './utils/route-test-helpers'

const toWindowsPaths = (rows: RouteRow[]): RouteRow[] =>
  rows.map((row) =>
    typeof row === 'string'
      ? row.replace(/\//g, '\\')
      : ([row[0].replace(/\//g, '\\'), ...row.slice(1)] as RouteRow),
  )

describe('flat file routes', () => {
  it('defines routes for flat files, including markdown', () => {
    expectRoutes([
      ...flatFileRoutes(),
      ['docs.tsx', 'root', 'docs'],
      ['docs.readme.md', 'root', 'docs/readme'],
    ])
  })

  it('skips files matched by ignoredRouteFiles', () => {
    expectRoutes(
      [
        ...flatFileRoutes(),
        'style.css',
        '_index.test.tsx',
        'styles/style.css',
        '__tests__/route.test.tsx',
      ],
      {
        ignoredRouteFiles: ['**/.*', '**/*.css', '**/*.test.{js,jsx,ts,tsx}'],
      },
    )
  })
})

describe('flat folder routes', () => {
  it('defines routes for flat folders', () => {
    expectRoutes(flatFolderRoutes())
  })

  it('defines routes for flat folders on Windows', () => {
    expectRoutes(toWindowsPaths(flatFolderRoutes()))
  })

  it('ignores non-route files in flat folders', () => {
    expectRoutes([
      ['$lang.$ref/_layout.tsx', 'root', ':lang/:ref'],
      ['$lang.$ref/component.tsx', '$lang.$ref/_layout', 'component'],
      ['$lang.$ref._index/route.tsx', '$lang.$ref/_layout', undefined, 'index'],
      '$lang.$ref._index/style.css',
      '$lang.$ref.$/model.server.ts',
      ['docs/_layout.tsx', 'root', 'docs'],
      ['docs/readme.route.mdx', 'docs/_layout', 'readme'],
    ])
  })
})

describe('folders without a layout', () => {
  it('keeps nested files as root routes with their full path', () => {
    expectRoutes([
      ['oauth/google.ts', 'root', 'oauth/google'],
      ['oauth/logout.ts', 'root', 'oauth/logout'],
      ['api/v1/users.ts', 'root', 'api/v1/users'],
      ['api.users.ts', 'root', 'api/users'],
    ])
  })

  it('does not nest under a sibling non-layout route', () => {
    expectRoutes([
      ['oauth.tsx', 'root', 'oauth'],
      ['oauth/google.tsx', 'root', 'oauth/google'],
    ])
  })

  it('nests index routes under the nearest layout across folders', () => {
    expectRoutes([
      ['dashboard/_layout.tsx', 'root', 'dashboard'],
      [
        'dashboard/projects/$id/index.tsx',
        'dashboard/_layout',
        'projects/:id',
        'index',
      ],
    ])
  })
})

describe('prefix-based colocation', () => {
  const dashboardIndex: RouteRow = [
    'dashboard/index.tsx',
    'root',
    'dashboard',
    'index',
  ]
  const colocatedFiles = [
    'dashboard/+/utils.ts',
    'dashboard/+components/avatar.tsx',
    'dashboard/+/utils/format.ts',
    'dashboard/+components/buttons/button.tsx',
    'dashboard/+utils.ts',
    'dashboard/+.ts',
  ]

  it('ignores + folders and + files inside route folders', () => {
    expectRoutes([
      dashboardIndex,
      ...colocatedFiles,
      ['users.$userId.tsx', 'root', 'users/:userId'],
      'users.$userId/+avatar.tsx',
      'users.$userId/+components/form.tsx',
    ])
  })

  it('ignores colocated files with Windows path separators', () => {
    expectRoutes(toWindowsPaths([dashboardIndex, ...colocatedFiles]))
  })

  it('treats + in the middle of a filename as a normal route', () => {
    expectRoutes([['users+admins.tsx', 'root', 'users+admins']])
  })

  it.each([
    ['+/utils.ts', 'root-level'],
    ['+utils.ts', 'root-level'],
    ['+lib/utils.ts', 'root-level'],
    ['dashboard/+/+/utils.ts', 'nested-anonymous'],
  ] as const)('rejects %s', (file, kind) => {
    expect(() => createRoutesFromFiles([file])).toThrowError(
      kind === 'root-level'
        ? `Colocation entries must live inside a route folder. Move '${file}' under an actual route directory.`
        : `Nested anonymous colocation folders (+/+/) are not allowed. Use named folders like +/components/ instead. Found in: ${file}`,
    )
  })
})

describe('custom colocation character', () => {
  it('uses the override and treats + files as routes', () => {
    expectRoutes(
      [
        ['dashboard/index.tsx', 'root', 'dashboard', 'index'],
        'dashboard/_utils.ts',
        'dashboard/_/helpers.ts',
        ['+utils.ts', 'root', '+utils'],
      ],
      { colocationChar: '_' },
    )
  })

  it.each(['_utils.ts', 'dashboard/_/_/helpers.ts'])(
    'rejects %s with the override',
    (file) => {
      expect(() =>
        createRoutesFromFiles([file], { colocationChar: '_' }),
      ).toThrowError(
        file === '_utils.ts'
          ? "Colocation entries must live inside a route folder. Move '_utils.ts' under an actual route directory."
          : 'Nested anonymous colocation folders (+/+/) are not allowed. Use named folders like +/components/ instead. Found in: dashboard/_/_/helpers.ts',
      )
    },
  )
})
