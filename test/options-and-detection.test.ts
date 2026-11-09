import * as path from 'path'
import {
  createRoutesFromFiles,
  expectRoutes,
  filesByRoutesDir,
  flattenRoutesById,
} from './utils/route-test-helpers'

describe('routing options', () => {
  describe('custom param prefix char', () => {
    it('should generate correct paths with custom param prefix', () => {
      const flatFiles = ['^userId.tsx', '^.tsx']
      const routes = createRoutesFromFiles(flatFiles, { paramChar: '^' })
      const manifest = flattenRoutesById(routes)
      expect(manifest['routes/^userId']!.path!).toBe(':userId')
      expect(manifest['routes/^']!.path!).toBe('*')
    })
  })

  describe('custom route regex', () => {
    it('passes routeRegex through autoRoutes()', () => {
      const routes = createRoutesFromFiles(
        ['admin/page.custom.tsx', 'admin/page.tsx'],
        { routeRegex: /\.custom\.tsx$/ },
      )
      const manifest = flattenRoutesById(routes)

      expect(manifest['routes/admin/page.custom']).toBeDefined()
      expect(manifest['routes/admin/page']).toBeUndefined()
    })
  })

  describe('optional segments', () => {
    it('generates optional paths for flat files, folders, and params', () => {
      expectRoutes([
        ['parent.(child).tsx', 'root', 'parent/child?'],
        ['_folder.parent.(child)/index.tsx', 'root', 'parent/child?', 'index'],
        ['parent/(child)/route.tsx', 'root', 'parent/child?'],
        ['parent.($child).tsx', 'root', 'parent/:child?'],
      ])
    })
  })

  describe('routesDir normalization', () => {
    it('supports nested directory entries', () => {
      const routes = createRoutesFromFiles(['users.tsx'], {
        routesDir: 'routes/public',
      })
      const manifest = flattenRoutesById(routes)
      expect(manifest['routes/public/users']).toBeDefined()
    })

    it('nests routes under layouts when prefix folders are repeated', () => {
      const routes = createRoutesFromFiles(
        ['admin/_layout.tsx', 'admin/dashboard.tsx'],
        { routesDir: 'routes/admin' },
      )
      const manifest = flattenRoutesById(routes)

      expect(manifest['routes/admin/admin/_layout']?.path).toBe('admin')
      expect(manifest['routes/admin/admin/dashboard']?.parentId).toBe(
        'routes/admin/admin/_layout',
      )
      expect(manifest['routes/admin/admin/dashboard']?.path).toBe('dashboard')
    })

    it('rejects dot-prefixed relative paths', () => {
      expect(() => {
        createRoutesFromFiles(['index.tsx'], { routesDir: './routes' })
      }).toThrow(
        "routesDir entries cannot contain '.' segments. Got: './routes'",
      )
    })

    it('supports parent directory segments', () => {
      const routes = createRoutesFromFiles(['index.tsx'], {
        routesDir: '../pages',
      })
      const manifest = flattenRoutesById(routes)

      expect(manifest['../pages/index']?.file).toBe('pages/index.tsx')
      expect(manifest['../pages/index']?.path).toBeUndefined()
    })

    it('rejects absolute paths', () => {
      expect(() => {
        createRoutesFromFiles(['index.tsx'], { routesDir: '/routes' })
      }).toThrow(
        "routesDir entries must be relative paths, not absolute. Got: '/routes'",
      )
    })

    it('rejects empty entries', () => {
      expect(() => {
        createRoutesFromFiles(['index.tsx'], { routesDir: '' })
      }).toThrow("routesDir entries must be non-empty strings. Got: ''")
    })
  })

  describe('routesDir mappings', () => {
    it('supports object form with multiple mounts', () => {
      const routes = createRoutesFromFiles([], {
        routesDir: {
          '/': 'app/routes',
          '/api': 'api/routes',
          '/docs': 'packages/docs/routes',
        },
        visitFiles: filesByRoutesDir({
          'app/routes': ['dashboard.tsx'],
          'packages/docs/routes': ['overview.tsx'],
          'api/routes': ['index.tsx'],
        }),
      })

      const manifest = flattenRoutesById(routes)
      expect(manifest['routes/dashboard']?.path).toBe('dashboard')
      expect(manifest['packages/docs/routes/overview']?.path).toBe(
        'docs/overview',
      )
      expect(manifest['api/routes/index']?.path).toBe('api')
      expect(manifest['api/routes/index']?.index).toBe(true)
    })

    it('nests discovered children under secondary mounts', () => {
      const routes = createRoutesFromFiles([], {
        routesDir: {
          '/': 'app/routes',
          '/api': 'api/routes',
          '/docs': 'packages/docs/routes',
        },
        visitFiles: filesByRoutesDir({
          'app/routes': ['_analytics.tsx'],
          'packages/docs/routes': ['overview.tsx'],
          'api/routes': [
            'index.tsx',
            'users/_layout.tsx',
            'users/settings.tsx',
          ],
        }),
      })

      const manifest = flattenRoutesById(routes)

      expect(manifest['routes/_analytics']?.parentId).toBe('root')
      expect(manifest['routes/_analytics']?.path).toBeUndefined()

      expect(manifest['api/routes/users/_layout']?.parentId).toBe('root')
      expect(manifest['api/routes/users/_layout']?.path).toBe('api/users')

      expect(manifest['api/routes/users/settings']?.parentId).toBe(
        'api/routes/users/_layout',
      )
      expect(manifest['api/routes/users/settings']?.path).toBe('settings')
    })

    it('keeps root app routes relative to the main app directory when using object mounts', () => {
      const routes = createRoutesFromFiles([], {
        routesDir: {
          '/': 'app/routes',
          '/shop': 'shop/routes',
        },
        visitFiles: filesByRoutesDir({
          'app/routes': ['_auth/_layout.tsx', '_auth/login.tsx'],
          'shop/routes': ['index.tsx'],
        }),
      })

      const manifest = flattenRoutesById(routes)

      expect(manifest['routes/_auth/_layout']?.file).toBe(
        'routes/_auth/_layout.tsx',
      )
      expect(manifest['routes/_auth/login']?.file).toBe(
        'routes/_auth/login.tsx',
      )
      expect(manifest['shop/routes/index']?.file).toBe(
        '../shop/routes/index.tsx',
      )
    })

    it('validates mount path syntax', () => {
      expect(() => {
        createRoutesFromFiles(['index.tsx'], {
          routesDir: { tools: 'tools/routes' },
        })
      }).toThrow("routesDir mount paths must start with '/'. Got: 'tools'")

      expect(() => {
        createRoutesFromFiles(['index.tsx'], {
          routesDir: { '/tools/': 'tools/routes' },
        })
      }).toThrow("routesDir mount paths cannot end with '/'. Got: '/tools/'")

      expect(() => {
        createRoutesFromFiles(['index.tsx'], {
          routesDir: { '': 'tools/routes' },
        })
      }).toThrow('routesDir mount paths must be non-empty strings.')

      expect(() => {
        createRoutesFromFiles(['index.tsx'], { routesDir: {} })
      }).toThrow('routesDir object must contain at least one entry.')

      expect(() => {
        createRoutesFromFiles(['index.tsx'], {
          routesDir: {
            '/tools': 'tools/routes',
            ' /tools ': 'other/routes',
          },
        })
      }).toThrow("Duplicate routesDir mount path detected: '/tools'.")
    })
  })

  describe('invalid route definitions', () => {
    it('rejects duplicate route ids from different extensions', () => {
      expect(() => createRoutesFromFiles(['foo.tsx', 'foo.jsx'])).toThrow(
        "Duplicate route id 'routes/foo'",
      )
    })

    it.each(['bad*.tsx', 'bad:segment.tsx'])(
      'rejects invalid route segment characters in %s',
      (filename) => {
        expect(() => createRoutesFromFiles([filename])).toThrow(
          /cannot contain "[*:]/,
        )
      },
    )
  })

  describe('app directory resolution', () => {
    it('anchors import prefixes to the root mount directory when present', () => {
      const routes = createRoutesFromFiles(['index.tsx'], {
        routesDir: { '/': 'packages/web/routes' },
      })

      const manifest = flattenRoutesById(routes)
      expect(manifest['packages/web/routes/index']?.file).toBe(
        'routes/index.tsx',
      )
    })

    it('respects __reactRouterAppDirectory when computing import prefixes without a root mount', () => {
      const originalAppDir = (globalThis as any).__reactRouterAppDirectory
      ;(globalThis as any).__reactRouterAppDirectory = path.resolve(
        process.cwd(),
        'app/router',
      )

      try {
        const routes = createRoutesFromFiles(['index.tsx'], {
          routesDir: { '/shop': 'shop/routes' },
        })

        const manifest = flattenRoutesById(routes)
        expect(manifest['shop/routes/index']?.file).toBe(
          '../../shop/routes/index.tsx',
        )
      } finally {
        ;(globalThis as any).__reactRouterAppDirectory = originalAppDir
      }
    })
  })
})

describe('special character escaping', () => {
  it('escapes underscores', () => {
    expectRoutes([
      ['[__].tsx', 'root', '__'],
      ['[_].tsx', 'root', '_'],
      ['_layout.[___]/index.tsx', 'root', '___', 'index'],
      ['_layout.parent.[__]/index.tsx', 'root', 'parent/__', 'index'],
    ])
  })
})

describe('route detection boundaries', () => {
  it('excludes nested files whose basename contains reserved characters', () => {
    const routes = createRoutesFromFiles([
      'admin/page?.tsx',
      'admin/page.tsx',
      'page?.tsx',
    ])

    expect(routes.map((route) => route.id)).toEqual([
      'routes/page?',
      'routes/admin/page',
    ])
  })

  it('applies a custom colocation char without a custom regex', () => {
    const routes = createRoutesFromFiles(
      ['admin/~/x.tsx', 'admin/~c/y.tsx', 'admin/page.tsx'],
      { colocationChar: '~' },
    )

    expect(routes.map((route) => route.id)).toEqual(['routes/admin/page'])
  })

  it('applies a custom routeRegex to backslash-separated nested files', () => {
    const routes = createRoutesFromFiles(
      ['admin\\page.tsx', 'admin\\a.route.tsx'],
      {
        routeRegex: /\.route\.tsx$/,
      },
    )

    expect(routes.map((route) => route.id)).toEqual(['routes/admin/a.route'])
  })

  it('honors flags on a custom routeRegex', () => {
    const routes = createRoutesFromFiles(['admin/A.TSX', 'admin/b.tsx'], {
      routeRegex: /\.tsx$/i,
    })

    expect(routes.map((route) => route.id)).toEqual([
      'routes/admin/A',
      'routes/admin/b',
    ])
  })

  it('tests every file from the start with a global routeRegex', () => {
    const routeRegex = /\.tsx$/g
    const files = ['admin/a.tsx', 'admin/b.tsx']

    const first = createRoutesFromFiles(files, { routeRegex })
    const second = createRoutesFromFiles(files, { routeRegex })

    expect(second).toEqual(first)
    expect(second.map((route) => route.id)).toEqual([
      'routes/admin/a',
      'routes/admin/b',
    ])
    expect(routeRegex.lastIndex).toBe(0)
  })

  it('keeps a sticky routeRegex anchored to the start of each path', () => {
    const routeRegex = /admin/y
    const files = ['admin/a.tsx', 'other/admin.tsx', 'admin/b.tsx']

    const first = createRoutesFromFiles(files, { routeRegex })
    const second = createRoutesFromFiles(files, { routeRegex })

    expect(second).toEqual(first)
    expect(second.map((route) => route.id)).toEqual([
      'routes/admin/a',
      'routes/admin/b',
    ])
  })

  it('rejects files that a custom visitFiles reports outside routesDir', () => {
    expect(() => createRoutesFromFiles(['../escape.tsx'])).toThrow(
      "Route id 'escape' does not start with expected prefix 'routes/'",
    )
  })

  it('keeps a stable output order for siblings', () => {
    const routes = createRoutesFromFiles([
      'users/route/route.tsx',
      'users/_layout.tsx',
      'users.tsx',
      'users/$id.tsx',
      'users/index.tsx',
      'users/(opt).tsx',
      'users/$.tsx',
      'users/new.tsx',
      '_auth/_layout.tsx',
      '_auth/login.tsx',
      'index.tsx',
    ])

    expect(routes.map((route) => route.id)).toEqual([
      'routes/index',
      'routes/users/route/route',
      'routes/_auth/_layout',
      'routes/users/_layout',
      'routes/users',
    ])
    expect(routes[3].children?.map((route) => route.id)).toEqual([
      'routes/users/index',
      'routes/users/new',
      'routes/users/(opt)',
      'routes/users/$id',
      'routes/users/$',
    ])
  })
})
